# Developer Examples

Endpoint: `POST https://fundmomentum.vc/_api/mcp` · JSON-RPC 2.0 over streamable HTTP
Auth: `X-API-Key: <key>`, or `Authorization: Bearer <key>`, or nothing at all on the keyless trial.

## No API key at all

`search_funds`, `get_fund`, `get_changes` and `check_lp_coverage` answer <!--fm:keyless_calls-->10<!--/fm:keyless_calls--> calls per caller per UTC day between them with no credential. Keyless `get_changes` looks back at most 7 days. Start here.

```bash
curl -s https://fundmomentum.vc/_api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_funds","arguments":{"stage":"seed","country":"Germany","limit":5}},"id":1}'
```

Once you hit the daily cap, a free key raises it to <!--fm:free_calls-->100<!--/fm:free_calls--> calls/month and widens the `get_changes` window to 30 days. Humans subscribe and copy a key at [fundmomentum.vc/pricing](https://fundmomentum.vc/pricing); [fundmomentum.vc/mcp](https://fundmomentum.vc/mcp) has the plans and client setup. Agents can self-register:

```bash
curl -s https://fundmomentum.vc/_api/agent/register \
  -H "Content-Type: application/json" \
  -d '{"agent_name":"your-agent-name"}'
```

There is **no `email` field**. That returns `201` with `"api_key"`, `"agent_id"` and
`"agent_credits": 25` with no payment, no approval and no human, so an agent can register and make a
useful call in the same second. The credits work on all six fund tools. The key is returned once; only a
hash is stored.

New keys are capped at 3 per IP and 10 per /24 per UTC day (`429` beyond that, naming both escape
routes).

Beyond the free 25, calls cost 1 credit (€0.01) on the free tools, and each Pro tool states its price in
[`/_api/mcp-tools`](https://fundmomentum.vc/_api/mcp-tools); credits never
expire. An exhausted balance, or a Pro tool called with **no key at all**, answers **HTTP `402`**
(previously JSON-RPC `-32001`) carrying an [MPP](https://mpp.dev) challenge payable in USDC on Tempo mainnet (chain `4217`). Pay it,
retry, and you get the data plus a receipt, with no account anywhere in the flow:

```bash
curl -fsSL https://tempo.xyz/install | bash
tempo wallet login
tempo request -X POST --json '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_fund_signals","arguments":{"slug":"speedinvest-africa-fund"}},"id":1}' https://fundmomentum.vc/_api/mcp
```

To buy a balance up front instead, `POST /_api/agent/credits/topup` with `{"amount_eur":20}`
(5/20/50/100) and pay the same challenge. Spending is capped at €1,000 per payer per UTC day, checked
*before* any challenge is issued.

The challenge is on a standard `WWW-Authenticate: Payment ...` header. A paid response carries
`Payment-Receipt` (base64url JSON with `method`, `reference`, `status`, `timestamp`), and the same
receipt is mirrored into `result._meta.payment_receipt` so an MCP client need not read HTTP headers.

**A paid call that then fails still returns its receipt.** Inline payments settle on-chain and are
not auto-refunded, so a `not_found` on a paid call comes back with `paid: true` and the
`Payment-Receipt` header. You are never charged without proof. Credit-funded calls are refunded
instead, and carry no receipt.

The 402 payload also names the free fallback: drop the `X-API-Key` header and the keyless allowance
still answers `search_funds`, `get_fund`, `get_changes` and `check_lp_coverage`.

## Python: Search Funds

```python
import requests
import json

API_KEY = "YOUR_API_KEY"   # omit the header entirely to use the keyless trial
BASE_URL = "https://fundmomentum.vc/_api/mcp"

def mcp_call(tool_name, arguments):
    r = requests.post(BASE_URL, headers={
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    }, json={
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": arguments},
        "id": 1
    })
    result = r.json()
    if "error" in result:
        raise Exception(result["error"]["message"])
    return json.loads(result["result"]["content"][0]["text"])

# Search seed funds in Germany
funds = mcp_call("search_funds", {
    "stage": "seed",
    "country": "Germany",
    "limit": 10
})
for fund in funds:
    print(f"{fund['name']} | {fund['country']} | {fund['fundingStage']}")
```

`stage` and `industry` are enums: lowercase with underscores (`pre_seed`, `series_a`, `ai_ml`,
`climate_sustainability`). Common spellings like `Pre-Seed` or `AI/ML` are normalised. `country` is
spelled out in full (`United States`), not an ISO code. `slug` values are not derivable from a fund's
display name, so call `search_funds` before `get_fund` rather than guessing.

## Python: Incremental sync with get_changes

Do not re-run `search_funds` on a schedule. `get_changes` returns only what moved, and an unchanged
window costs a few bytes because the previous `etag` goes back as `if_none_match`.

```python
import time

state = {"since": None, "etag": None}   # persist this between runs

def poll_once():
    args = {"limit": 200}
    if state["since"]:
        args["since"] = state["since"]        # omit on the first call: last 7 days
    if state["etag"]:
        args["if_none_match"] = state["etag"]

    page = mcp_call("get_changes", args)

    if page.get("unchanged"):
        return []                              # nothing moved, no rows sent

    state["since"] = page["next_since"]
    state["etag"] = page["etag"]
    rows = page["changes"]

    # has_more means the window was truncated — drain before sleeping
    while page.get("has_more"):
        page = mcp_call("get_changes", {"since": state["since"], "limit": 200})
        state["since"] = page["next_since"]
        state["etag"] = page["etag"]
        rows += page["changes"]

    return rows

while True:
    for row in poll_once():
        print(f"{row['changed_at']} {row['change_type']:16} {row['name']} ({row['confidence']})")
    time.sleep(3600)
```

Each change row carries `slug`, `name`, `country`, `fundingStage`, `fundSize`, `change_type`,
`changed_at`, `confidence` and `url`. Fetch the full record with `get_fund(slug)` only for the rows
you actually care about.

## HTTP: Incremental sync without MCP

The same data is on `GET /_api/changes` as an ordinary conditional request. Keep the `ETag` response
header, send it back as `If-None-Match`, and an unchanged window answers `304 Not Modified` with an
empty body.

```bash
curl -s -D - -o /dev/null \
  -H 'If-None-Match: "2126d79bb6487457b97d8b05eb84253e"' \
  "https://fundmomentum.vc/_api/changes?since=2026-08-20T00:00:00Z&limit=50"
```

## Python: Match Startup

```python
matches = mcp_call("match_startup", {
    "description": "B2B SaaS for estate management and notaries. AI document processing. DACH market. Pre-seed, raising €500K.",
    "stage": "pre_seed",
    "country": "Austria"
})
for m in matches.get("matches", []):
    print(f"{m['match_score']}/100 — {m['name']}: {m['match_reason']}")
```

## JavaScript: Get Fund Signals

```javascript
async function getFundSignals(slug) {
  const response = await fetch("https://fundmomentum.vc/_api/mcp", {
    method: "POST",
    headers: {
      "X-API-Key": process.env.FM_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "get_fund_signals", arguments: { slug } },
      id: 1
    })
  });
  const { result } = await response.json();
  return JSON.parse(result.content[0].text);
}

const signals = await getFundSignals("speedinvest-africa-fund");
console.log(signals.thesisTags);
console.log(signals.founderDos);
```

## n8n Workflow

For a scheduled workflow, poll `get_changes`, not `search_funds`.

1. Schedule Trigger Node
2. HTTP Request Node (POST `https://fundmomentum.vc/_api/mcp`)
3. Header: `X-API-Key: {{ $env.FM_API_KEY }}`
4. Body:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_changes",
    "arguments": {
      "since": "{{ $json.next_since }}",
      "if_none_match": "{{ $json.etag }}",
      "limit": 200
    }
  },
  "id": 1
}
```
5. JSON Parse Node: parse `result.content[0].text`
6. IF Node: stop when `unchanged` is true
7. Store `next_since` and `etag` for the next run, then loop over `changes`

## Python: LP coverage and LP Radar

Check coverage first. `check_lp_coverage` is free, works with no key and returns counts only:
never a name or website. Counts under 5 come back as the string `"<5"` and zero as `"none"`, so do
not treat them as integers.

```python
cov = mcp_call("check_lp_coverage", {"country": "Germany", "lp_type": "Family office / Holding"})
print(f"{cov['matched']} of {cov['of_total_disclosed']} disclosed LPs match; "
      f"{cov['backs_emerging_managers']} have backed emerging managers")
# {"matched": "<5", "of_total_disclosed": 608, "backs_emerging_managers": "<5",
#  "undisclosed_hq_count": "<5", "filters_applied": {...}, "next_step": "https://fundmomentum.vc/lp-radar"}
```

`lp_type` is one of the values listed in the tool's input schema (`Pension fund`,
`Family office / Holding`, `Fund-of-Funds`, …); common spellings such as `family office` are
normalised. `country` is spelled out in full; two-letter ISO codes are accepted too.

`search_lps` returns the records themselves, up to 25 per call, for the key of an account holding
[LP Radar](https://fundmomentum.vc/lp-radar) (€199/month or €1,499/year). Agent keys cannot hold it,
and it is never sold per call, on credits or over MPP. Without it the call fails with HTTP `403` and
JSON-RPC `-32001` (no payment challenge, nothing charged), and `error.data` still carries the
coverage for your filters:

```python
r = requests.post(BASE_URL, headers={"X-API-Key": API_KEY, "Content-Type": "application/json"}, json={
    "jsonrpc": "2.0", "method": "tools/call", "id": 1,
    "params": {"name": "search_lps", "arguments": {"country": "Germany", "limit": 25}},
})
body = r.json()
if "error" in body and body["error"].get("data", {}).get("error_reason") == "lp_access_required":
    data = body["error"]["data"]
    print(f"{data['coverage']['matched']} LPs match — LP Radar needed: {data['lp_radar']['url']}")
else:
    lps = json.loads(body["result"]["content"][0]["text"])
```

The record fields (name, slug, LP type, HQ country and city, geographic focus, website,
emerging-manager backing, verified flag) are described in the tool's own definition on the
[server card](https://fundmomentum.vc/_api/well-known/mcp/server-card). `website` is `null` when
none is on record, never omitted.

## Check Call Usage

Quota lives in the `_meta` block of every response. Note the leading underscore. Its **shape
depends on how you authenticated**, so read it with `.get()` rather than indexing:

| Auth | Keys in `_meta` |
|---|---|
| Keyless trial | `auth: "keyless_trial"`, `calls_used`, `calls_limit`, `calls_remaining`, `resets_at`, `upgrade_note` |
| Agent (credits) | `credits_remaining`, `cost_per_call`, `billing: "per_call"`, plus `buy_more` once below 100 |
| Free / Starter / Pro | `calls_used`, `calls_limit`, `calls_remaining` |

Only the keyless branch carries `auth` and `resets_at`; only the agent branch carries
`credits_remaining`.

```python
result = r.json()["result"]
meta = result.get("_meta", {})

if "credits_remaining" in meta:                 # agent tier, billed per call
    print(f"Credits left: {meta['credits_remaining']} at {meta.get('cost_per_call')}")
    if meta.get("buy_more"):
        print(f"Running low — a human can top up at {meta['buy_more']}")
else:                                           # keyless trial or a monthly tier
    print(f"Auth mode: {meta.get('auth', 'api_key')}")
    print(f"Calls used: {meta.get('calls_used')}/{meta.get('calls_limit')}")
    print(f"Remaining: {meta.get('calls_remaining')}")
    if meta.get("resets_at"):
        print(f"Resets at: {meta['resets_at']}")
```

The matching failure modes are HTTP status codes: `402` when an agent is out of credits, `429`
when a monthly quota is exhausted, `401` for an unrecognised key, `403` (`lp_access_required`) for
`search_lps` without LP Radar.

## Tool reference

| Tool | Title | Tier | Key arguments |
|---|---|---|---|
| `search_funds` | Search VC funds | Free | `stage`, `country`, `industry`, `limit` (1–20, default 10) |
| `get_fund` | Get fund profile | Free | `slug` (required) |
| `get_changes` | Get changed funds since | Free | `since`, `if_none_match`, `limit` (1–200, default 50) |
| `get_fund_signals` | Get fund investor signals | Pro | `slug` (required) |
| `get_gp_profile` | Get General Partner profiles | Pro | `fund_slug` (required), `gp_name` |
| `match_startup` | Match startup to funds | Pro | `description` (required, max 500 chars), `stage`, `country` |
| `check_lp_coverage` | Check LP coverage | Free, keyless | `country`, `lp_type` |
| `search_lps` | Search LP records | LP Radar | `country`, `lp_type`, `limit` (1–25, default 10; above 25 is rejected) |

All eight are `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`,
`openWorldHint: false`, so they are safe for an agent to call unattended.

The authoritative, always-current version of this table is the
[server card](https://fundmomentum.vc/_api/well-known/mcp/server-card).
