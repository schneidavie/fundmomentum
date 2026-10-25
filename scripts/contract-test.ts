/**
 * Contract test: MCP tool vs REST v1 equivalent.
 *
 * For each pair the SAME input goes to POST /_api/mcp (tools/call) and to the
 * REST v1 endpoint. The test fails on any difference in: result top-level keys,
 * field names and types of every result item, result values (volatile ones
 * ignored), _meta field names, and error_reason. Pro tools without a key must
 * answer payment-required on both paths (REST 402 with WWW-Authenticate, MCP
 * -32042) at the same price, and invalid_args / not_found must be refused
 * before any payment on both.
 *
 * Run by hand:   FM_API_KEY=<free key> node scripts/contract-test.ts
 * Run in CI:     see .github/workflows/contract-test.yml (weekly + manual)
 *
 * Env:
 *   FM_BASE      default https://fundmomentum.vc
 *   FM_API_KEY   a Free key is enough. Without one the keyless allowance
 *                (10 calls per UTC day) runs out after ~4 pairs; pairs that hit
 *                a quota are reported SKIP, not FAIL.
 *
 * Needs Node 22.6+ (type stripping; Node 24 runs .ts directly). No dependencies.
 * The API key is only ever sent as a header and is never printed.
 * Exit code: 1 if any pair FAILs, otherwise 0.
 */

const BASE = (process.env.FM_BASE ?? "https://fundmomentum.vc").replace(/\/$/, "");
const KEY = process.env.FM_API_KEY ?? "";

type Json = any;
type Side =
  | { kind: "ok"; payload: Json; meta: Json; status: number; headers: Headers }
  | { kind: "not_modified"; status: number; headers: Headers }
  | { kind: "error"; reason: string; status: number; message: string; body: Json }
  | { kind: "payment"; status: number; price: string | null; challengeKind: string; body: Json }
  | { kind: "fatal"; message: string };

const QUOTA_REASONS = new Set(["anon_quota_exceeded", "anon_ip_ceiling_exceeded", "quota_exceeded", "burst_limit", "agent_minute_limit", "ip_minute_limit"]);

// ------------------------------------------------------------------ http

async function http(method: string, path: string, opts: { headers?: Record<string, string>; body?: string } = {}) {
  const res = await fetch(BASE + path, { method, headers: opts.headers, body: opts.body, redirect: "manual" });
  const text = await res.text();
  let json: Json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, text, json };
}

const keyHeader = (withKey: boolean): Record<string, string> => (withKey && KEY ? { "X-API-Key": KEY } : {});

/** Decode the price out of an MPP challenge, wherever the transport put it. */
function priceOf(challenge: Json | string | null): string | null {
  try {
    let request: Json = challenge;
    if (typeof challenge === "string") {
      const m = challenge.match(/request="([^"]+)"/);
      if (!m) return null;
      request = m[1];
    }
    if (typeof request === "string") request = JSON.parse(Buffer.from(request, "base64url").toString("utf8"));
    return request?.amount != null ? String(request.amount) : null;
  } catch {
    return null;
  }
}

async function mcp(tool: string, args: Json, opts: { key?: boolean; transport?: boolean } = {}): Promise<Side> {
  const headers: Record<string, string> = { "content-type": "application/json", ...keyHeader(opts.key !== false) };
  // MCP transport headers make a payment challenge arrive as JSON-RPC -32042
  // (what an MCP client sees); without them it is a plain HTTP 402.
  if (opts.transport) {
    headers.accept = "application/json, text/event-stream";
    headers["mcp-method"] = "tools/call";
  } else headers.accept = "application/json";
  const { res, json } = await http("POST", "/_api/mcp", {
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: args } }),
  });
  if (res.status === 402) {
    const www = res.headers.get("www-authenticate");
    return { kind: "payment", status: 402, price: priceOf(www), challengeKind: "http-402", body: json };
  }
  if (!json) return { kind: "fatal", message: `MCP ${tool}: HTTP ${res.status}, not JSON` };
  if (json.error) {
    if (json.error.code === -32042) {
      return { kind: "payment", status: 200, price: priceOf(json.error.data?.challenges?.[0]?.request ?? null), challengeKind: "-32042", body: json };
    }
    return { kind: "error", reason: json.error.data?.error_reason ?? String(json.error.code), status: res.status, message: json.error.message, body: json };
  }
  if (json.result?.isError) {
    return { kind: "error", reason: json.result._meta?.error_reason ?? "tool_error", status: res.status, message: String(json.result.content?.[0]?.text ?? ""), body: json };
  }
  let payload: Json = null;
  try {
    payload = JSON.parse(json.result.content[0].text);
  } catch {
    payload = json.result.content?.[0]?.text ?? null;
  }
  return { kind: "ok", payload, meta: json.result._meta ?? {}, status: res.status, headers: res.headers };
}

async function rest(method: "GET" | "POST", path: string, opts: { key?: boolean; body?: Json; headers?: Record<string, string> } = {}): Promise<Side> {
  const headers: Record<string, string> = { ...keyHeader(opts.key !== false), ...(opts.headers ?? {}) };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const { res, json } = await http(method, path, { headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  if (res.status === 304) return { kind: "not_modified", status: 304, headers: res.headers };
  if (res.status === 402) {
    const www = res.headers.get("www-authenticate");
    if (www) return { kind: "payment", status: 402, price: priceOf(www), challengeKind: "http-402", body: json };
    if (json?.error) return { kind: "error", reason: json.error.error_reason, status: 402, message: json.error.message, body: json };
  }
  if (!json) return { kind: "fatal", message: `REST ${path}: HTTP ${res.status}, not JSON` };
  if (json.error && typeof json.error === "object" && res.status >= 400) {
    return { kind: "error", reason: json.error.error_reason ?? json.error.code, status: res.status, message: json.error.message, body: json };
  }
  const { _meta, ...payload } = json;
  return { kind: "ok", payload: payload.data !== undefined && Object.keys(payload).length === 1 ? payload.data : payload, meta: _meta ?? {}, status: res.status, headers: res.headers };
}

// ------------------------------------------------------------------ comparison

/** Values that legitimately differ between two calls a moment apart. */
const VOLATILE_KEY = /^(etag|since|next_since|since_floor|resets_at|generated_at|timestamp|calls_used|calls_remaining|calls_limit|credits_remaining|retrieved_at|upgrade_note|notices|payment_receipt|payment_receipt_encoded)$|(_at|At)$/;

function strip(v: Json): Json {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === "object") {
    const o: Record<string, Json> = {};
    for (const k of Object.keys(v).sort()) if (!VOLATILE_KEY.test(k)) o[k] = strip(v[k]);
    return o;
  }
  return v;
}

const typeOf = (v: Json) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);

/** Field names and types, with array items merged, so item shapes compare without comparing data. */
function shape(v: Json): Json {
  if (Array.isArray(v)) {
    const merged: Record<string, Set<string>> = {};
    let scalar: Set<string> | null = null;
    for (const item of v) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const s = shape(item) as Record<string, Json>;
        for (const k of Object.keys(s)) (merged[k] ??= new Set()).add(JSON.stringify(s[k]));
      } else (scalar ??= new Set()).add(typeOf(item));
    }
    const items: Record<string, string> = {};
    for (const k of Object.keys(merged).sort()) items[k] = [...merged[k]].sort().join("|");
    return { "[]": scalar ? [...scalar].sort().join("|") : items };
  }
  if (v && typeof v === "object") {
    const o: Record<string, Json> = {};
    for (const k of Object.keys(v).sort()) o[k] = shape(v[k]);
    return o;
  }
  return typeOf(v);
}

function diff(a: Json, b: Json, path = "$"): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const out: string[] = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) out.push(`${path}.${k}: only on REST`);
      else if (!(k in b)) out.push(`${path}.${k}: only on MCP`);
      else out.push(...diff(a[k], b[k], `${path}.${k}`));
    }
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) return [`${path}: array length ${a.length} (MCP) vs ${b.length} (REST)`];
  if (Array.isArray(a) && Array.isArray(b)) return a.flatMap((x, i) => diff(x, b[i], `${path}[${i}]`));
  return [`${path}: ${JSON.stringify(a)?.slice(0, 60)} (MCP) vs ${JSON.stringify(b)?.slice(0, 60)} (REST)`];
}

// ------------------------------------------------------------------ results

type Row = { name: string; status: "PASS" | "FAIL" | "SKIP"; detail: string };
const rows: Row[] = [];
const record = (name: string, status: Row["status"], detail = "") => rows.push({ name, status, detail });

function quotaSkip(...sides: Side[]): string | null {
  for (const s of sides) if (s.kind === "error" && QUOTA_REASONS.has(s.reason)) return `quota: ${s.reason}`;
  return null;
}

/** Compare two successful sides: shape of result, values, _meta field names. */
function compareOk(m: Side, r: Side, opts: { values?: boolean } = {}): string[] {
  if (m.kind !== "ok" || r.kind !== "ok") return [`expected ok/ok, got ${m.kind}/${r.kind}`];
  const problems: string[] = [];
  const sm = shape(strip(m.payload));
  const sr = shape(strip(r.payload));
  problems.push(...diff(sm, sr, "shape"));
  if (opts.values !== false) problems.push(...diff(strip(m.payload), strip(r.payload), "value"));
  const metaKeys = (x: Json) => Object.keys(x ?? {}).filter((k) => k !== "notices").sort();
  problems.push(...diff(metaKeys(m.meta), metaKeys(r.meta), "_meta.keys"));
  if (m.meta?.auth !== r.meta?.auth) problems.push(`_meta.auth: ${m.meta?.auth} (MCP) vs ${r.meta?.auth} (REST)`);
  return problems;
}

// A Free key has a per-minute pace limit; pause between pairs so the test never trips it (override with FM_PACE_MS).
const PACE_MS = Number(process.env.FM_PACE_MS ?? 4000);
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function pair(name: string, run: () => Promise<{ m: Side; r: Side; extra?: string[]; values?: boolean }>) {
  if (rows.length > 0 && KEY) await sleep(PACE_MS);
  try {
    const { m, r, extra = [], values } = await run();
    for (const s of [m, r]) {
      // A missing prerequisite (the pair that was meant to supply a slug or ETag was skipped) is not a contract failure.
      if (s.kind === "fatal") return record(name, s.message.startsWith("no ") ? "SKIP" : "FAIL", s.message.startsWith("no ") ? `prerequisite missing: ${s.message}` : s.message);
    }
    const skip = quotaSkip(m, r);
    if (skip) return record(name, "SKIP", skip);
    const problems = [...extra];
    if (m.kind === "payment" || r.kind === "payment") {
      // A payment challenge is the pass condition for these pairs; its checks live in `extra`.
    } else if (m.kind === "error" || r.kind === "error") {
      if (m.kind !== r.kind) problems.push(`MCP ${m.kind}${m.kind === "error" ? ":" + m.reason : ""} vs REST ${r.kind}${r.kind === "error" ? ":" + r.reason : ""}`);
      else if (m.kind === "error" && r.kind === "error" && m.reason !== r.reason) problems.push(`error_reason: ${m.reason} (MCP) vs ${r.reason} (REST)`);
      if (r.kind === "error" && !(r.body?.error?.next_step && r.body.error.message && r.body.error.code)) problems.push("REST error lacks code/message/next_step");
    } else problems.push(...compareOk(m, r, { values }));
    record(name, problems.length ? "FAIL" : "PASS", problems.slice(0, 6).join("; "));
  } catch (e) {
    record(name, "FAIL", `exception: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ------------------------------------------------------------------ pairs

const today = new Date();
const daysAgo = (n: number) => new Date(today.getTime() - n * 86400_000).toISOString().slice(0, 10);

async function main() {
  console.log(`Contract test against ${BASE} ${KEY ? "(with API key)" : "(keyless: expect SKIPs once the 10 daily calls are used)"}\n`);

  let slug = "";

  await pair("search_funds  stage+country+limit", async () => {
    const m = await mcp("search_funds", { stage: "seed", country: "Austria", limit: 3 });
    const r = await rest("GET", "/_api/v1/funds?stage=seed&country=Austria&limit=3");
    if (m.kind === "ok") slug = m.payload?.results?.[0]?.slug ?? "";
    return { m, r };
  });

  await pair("search_funds  industry filter", async () => ({
    m: await mcp("search_funds", { industry: "fintech", limit: 3 }),
    r: await rest("GET", "/_api/v1/funds?industry=fintech&limit=3"),
  }));

  await pair("search_funds  closed_since", async () => ({
    m: await mcp("search_funds", { closed_since: daysAgo(120), limit: 3 }),
    r: await rest("GET", `/_api/v1/funds?closed_since=${daysAgo(120)}&limit=3`),
  }));

  await pair("search_funds  offset paging", async () => ({
    // Paging is paid/Pro. Whichever way the key falls, both paths must agree:
    // the same page, or the same refusal.
    m: await mcp("search_funds", { limit: 3, offset: 3 }),
    r: await rest("GET", "/_api/v1/funds?limit=3&offset=3"),
  }));

  await pair("search_funds  invalid stage (400, before any payment)", async () => ({
    m: await mcp("search_funds", { stage: "bogus" }),
    r: await rest("GET", "/_api/v1/funds?stage=bogus"),
    extra: [],
  }));

  await pair("get_fund      slug from search", async () => {
    if (!slug) return { m: { kind: "fatal", message: "no slug from the search pair (it skipped or failed)" } as Side, r: { kind: "fatal", message: "-" } as Side };
    return { m: await mcp("get_fund", { slug }), r: await rest("GET", `/_api/v1/funds/detail?slug=${encodeURIComponent(slug)}`) };
  });

  await pair("get_fund      unknown slug (404, no charge)", async () => {
    const m = await mcp("get_fund", { slug: "zz-contract-test-no-such-fund" });
    const r = await rest("GET", "/_api/v1/funds/detail?slug=zz-contract-test-no-such-fund");
    const extra: string[] = [];
    if (r.kind === "error" && r.status !== 404) extra.push(`REST status ${r.status}, expected 404`);
    return { m, r, extra };
  });

  // get_changes: fixed window so both calls see the same rows.
  const since = `${daysAgo(3)}T00:00:00Z`;
  let etag = "";
  await pair("get_changes   since+limit", async () => {
    const m = await mcp("get_changes", { since, limit: 3 });
    const r = await rest("GET", `/_api/v1/changes?since=${since}&limit=3`);
    if (r.kind === "ok") etag = r.headers.get("etag") ?? "";
    const extra: string[] = [];
    if (m.kind === "ok" && r.kind === "ok" && m.payload?.etag !== undefined && r.headers.get("etag") !== m.payload.etag) extra.push("ETag header differs from payload etag");
    return { m, r, extra };
  });

  await pair("get_changes   If-None-Match -> unchanged / 304", async () => {
    if (!etag) return { m: { kind: "fatal", message: "no ETag from the previous pair" } as Side, r: { kind: "fatal", message: "-" } as Side };
    const m = await mcp("get_changes", { since, limit: 3, if_none_match: etag });
    const r = await rest("GET", `/_api/v1/changes?since=${since}&limit=3`, { headers: { "If-None-Match": etag } });
    const extra: string[] = [];
    if (m.kind === "ok" && m.payload?.unchanged !== true) extra.push("MCP did not answer unchanged:true for a matching etag");
    if (r.kind !== "not_modified") extra.push(`REST answered ${r.kind} instead of 304 for a matching If-None-Match`);
    // Both must agree, but the shapes differ by design (body vs empty 304), so bypass compareOk.
    return { m: m.kind === "ok" ? ({ kind: "ok", payload: {}, meta: {}, status: 200, headers: new Headers() } as Side) : m, r: r.kind === "not_modified" ? ({ kind: "ok", payload: {}, meta: {}, status: 200, headers: new Headers() } as Side) : r, extra };
  });

  await pair("304 rule      matching request is not counted", async () => {
    const before = await rest("GET", "/_api/v1/usage");
    if (before.kind !== "ok") return { m: before, r: before };
    if (!etag) return { m: { kind: "fatal", message: "no ETag" } as Side, r: { kind: "fatal", message: "-" } as Side };
    const cond = await rest("GET", `/_api/v1/changes?since=${since}&limit=3`, { headers: { "If-None-Match": etag } });
    const mcpCond = await mcp("get_changes", { since, limit: 3, if_none_match: etag });
    const after = await rest("GET", "/_api/v1/usage");
    const extra: string[] = [];
    if (cond.kind !== "not_modified") extra.push(`REST conditional answered ${cond.kind}, not 304`);
    if (after.kind === "ok") {
      for (const f of ["calls_used", "credits_remaining"]) {
        if (before.payload?.[f] !== after.payload?.[f]) extra.push(`${f} moved ${before.payload?.[f]} -> ${after.payload?.[f]} across two matching conditional requests`);
      }
    }
    const fake: Side = { kind: "ok", payload: {}, meta: {}, status: 200, headers: new Headers() };
    return { m: mcpCond.kind === "error" ? mcpCond : fake, r: cond.kind === "error" ? cond : fake, extra };
  });

  await pair("check_lp_coverage country=Germany", async () => ({
    m: await mcp("check_lp_coverage", { country: "Germany" }),
    r: await rest("GET", "/_api/v1/lps/coverage?country=Germany"),
  }));

  await pair("get_usage", async () => ({
    m: await mcp("get_usage", {}),
    r: await rest("GET", "/_api/v1/usage"),
    values: false, // counters move between the two calls; field names and types still must match
  }));

  // Pro tools WITHOUT a key: payment required on both, same price; refused
  // before payment for not_found and invalid_args.
  const knownSlug = () => slug || "100x100-fund-ii";

  await pair("get_fund_signals no key -> payment required, same price", async () => {
    const m = await mcp("get_fund_signals", { slug: knownSlug() }, { key: false, transport: true });
    const r = await rest("GET", `/_api/v1/funds/signals?slug=${encodeURIComponent(knownSlug())}`, { key: false });
    return { m, r, extra: payExtra(m, r) };
  });

  await pair("get_gp_profile   no key -> payment required, same price", async () => {
    const m = await mcp("get_gp_profile", { fund_slug: knownSlug() }, { key: false, transport: true });
    const r = await rest("GET", `/_api/v1/funds/gps?slug=${encodeURIComponent(knownSlug())}`, { key: false });
    return { m, r, extra: payExtra(m, r, true) };
  });

  await pair("match_startup    no key -> payment required, same price", async () => {
    const args = { description: "Seed-stage climate hardware startup in Austria raising EUR 2M" };
    const m = await mcp("match_startup", args, { key: false, transport: true });
    const r = await rest("POST", "/_api/v1/match", { key: false, body: args });
    return { m, r, extra: payExtra(m, r) };
  });

  await pair("get_fund_signals no key + unknown slug -> not_found, no challenge", async () => {
    const m = await mcp("get_fund_signals", { slug: "zz-contract-test-no-such-fund" }, { key: false, transport: true });
    const r = await rest("GET", "/_api/v1/funds/signals?slug=zz-contract-test-no-such-fund", { key: false });
    const extra: string[] = [];
    if (m.kind === "payment" || r.kind === "payment") extra.push("a payment challenge was issued for a fund that does not exist");
    return { m, r, extra };
  });

  await pair("match_startup    no key + missing description -> invalid_args, no challenge", async () => {
    const m = await mcp("match_startup", {}, { key: false, transport: true });
    const r = await rest("POST", "/_api/v1/match", { key: false, body: {} });
    const extra: string[] = [];
    if (m.kind === "payment" || r.kind === "payment") extra.push("a payment challenge was issued for invalid arguments");
    return { m, r, extra };
  });

  report();
}

function payExtra(m: Side, r: Side, _gp = false): string[] {
  const extra: string[] = [];
  if (m.kind !== "payment") extra.push(`MCP did not answer payment required (got ${m.kind}${m.kind === "error" ? ":" + m.reason : ""})`);
  if (r.kind !== "payment") extra.push(`REST did not answer 402 (got ${r.kind}${r.kind === "error" ? ":" + r.reason : ""})`);
  if (m.kind === "payment" && r.kind === "payment") {
    if (m.challengeKind !== "-32042") extra.push(`MCP challenge arrived as ${m.challengeKind}, expected -32042`);
    if (r.status !== 402) extra.push(`REST status ${r.status}, expected 402`);
    if (m.price === null || r.price === null) extra.push(`could not read a price (MCP ${m.price}, REST ${r.price})`);
    else if (m.price !== r.price) extra.push(`price differs: ${m.price} (MCP) vs ${r.price} (REST)`);
  }
  // Payment-required is the pass condition here, so neutralise the generic ok/ok comparison.
  return extra;
}

function report() {
  const w = Math.max(...rows.map((r) => r.name.length));
  console.log(`${"PAIR".padEnd(w)}  RESULT  DETAIL`);
  console.log(`${"-".repeat(w)}  ------  ------`);
  for (const r of rows) console.log(`${r.name.padEnd(w)}  ${r.status.padEnd(6)}  ${r.detail}`);
  const fail = rows.filter((r) => r.status === "FAIL").length;
  const skip = rows.filter((r) => r.status === "SKIP").length;
  console.log(`\n${rows.length - fail - skip} passed, ${fail} failed, ${skip} skipped`);
  if (skip) console.log("Skipped pairs hit a quota. Re-run with FM_API_KEY, or after 00:00 UTC.");
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("contract test crashed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
