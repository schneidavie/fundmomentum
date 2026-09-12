# Fund Momentum — Live VC Intelligence Platform

> <!--fm:funds-->1000+<!--/fm:funds--> actively deploying VC funds · <!--fm:lps-->415<!--/fm:lps--> disclosed LPs · GP Signal Profiles · FM15 Ranking · MCP Server for AI agents

**[fundmomentum.vc](https://fundmomentum.vc)** · [MCP Docs](https://fundmomentum.vc/mcp) · [FM15 Ranking](https://fundmomentum.vc/fm15-2026) · [Smithery](https://smithery.ai/servers/djschneida/fundmomentum)

## Try it right now — no key, no signup

`search_funds` and `get_fund` answer <!--fm:keyless_calls-->10<!--/fm:keyless_calls--> calls per caller per UTC day with **no credential at all**. Paste this:

```bash
curl -s https://fundmomentum.vc/_api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_funds","arguments":{"stage":"seed","country":"Germany","limit":5}},"id":1}'
```

Real data, no card, no email address. Quota headers, the free key and the other four tools: [MCP Server](#mcp-server).

---

## What is Fund Momentum?

Fund Momentum is a live VC intelligence platform built for founders raising capital. We track **<!--fm:funds-->1000+<!--/fm:funds--> actively deploying VC funds** — all raised capital since September 2024 — plus **<!--fm:lps-->415<!--/fm:lps--> disclosed institutional LPs**, with weekly-updated GP Signal Profiles that go beyond fund basics.

**The problem:** Most VC databases are graveyard tours. Funds that stopped deploying 18 months ago, GPs who moved on, theses that haven't been updated since the fund closed. Founders pitch 40 investors and discover half of them aren't writing checks anymore.

**The solution:** Fund Momentum only lists funds that raised capital since September 2024. Every fund has verified deployment signals, not scraped summaries, and every fund profile carries a provenance block naming its source, last verification date and confidence.

> The counts above are generated, not typed. [`scripts/sync-counts.sh`](scripts/sync-counts.sh)
> reads a live `SELECT COUNT(*)` from the [server card](https://fundmomentum.vc/_api/well-known/mcp/server-card)
> and rounds the fund count down, so the published figure is always an
> understatement rather than a stale boast — see [Keeping the numbers honest](#keeping-the-numbers-honest).

---

## MCP Server

Connect Claude, Cursor, or any MCP-compatible AI directly to Fund Momentum.

### The keyless trial

`search_funds` and `get_fund` answer **<!--fm:keyless_calls-->10<!--/fm:keyless_calls--> calls per caller per UTC day with no credential at all**. No signup, no card, no key. This is the front door — see real data before you decide anything. The curl at the top of this README is a complete, working call.

Every response carries a `_meta` block telling you where you stand:

```json
"_meta": {
  "auth": "keyless_trial",
  "calls_used": 1,
  "calls_limit": 10,
  "calls_remaining": 9,
  "resets_at": "2026-08-26T00:00:00.000Z"
}
```

The keyless trial covers `search_funds` and `get_fund` only. `get_changes` is free but needs a key — see below.

### Access without registration

There is no signup wall. An agent can discover this server, pay for what it needs and get data with **no human, no account and no email** at any point.

| Access | How you get it | What works | Limits |
|---|---|---|---|
| **Keyless** | Nothing. Just call the endpoint. | `search_funds`, `get_fund` | 10 calls/caller/UTC day |
| **Anonymous key** | `POST {"agent_name":"..."}` to `/_api/agent/register` | All six tools on credits. **25 free credits** on creation. | 3 new keys per IP, 10 per /24, per day |
| **Paid, inline** | Nothing. Call a Pro tool, get `402`, pay, retry. | All six tools, priced per call | €1,000 per payer per day |
| **Paid, prepaid** | `POST /_api/agent/credits/topup`, pay the challenge | All six tools on credits | €5 / €20 / €50 / €100 |
| **Linked** *(optional)* | `POST /_api/agent/link` with an email | Everything above, plus invoices and a dashboard | Grants no extra access |

Per-call prices: free tools €0.01, `get_fund_signals` €0.10, `get_gp_profile` €0.10, `match_startup` €0.25.

### Getting a key

Both routes are free and take under a minute.

**Humans:** [fundmomentum.vc/mcp](https://fundmomentum.vc/mcp) documents the MCP plans and the client setup; you subscribe and copy the key itself at [fundmomentum.vc/pricing](https://fundmomentum.vc/pricing).

**Autonomous agents:** no registration and no email are required at all. There is **no `email` field** on this endpoint.

```bash
curl -s https://fundmomentum.vc/_api/agent/register \
  -H "Content-Type: application/json" \
  -d '{"agent_name":"your-agent-name"}'
```

`201 Created`:

```json
{
  "api_key": "fm_agent_...",
  "agent_id": "agt_...",
  "status": "registered",
  "agent_credits": 25,
  "free_credits_granted": 25,
  "cost_per_free_call": "€0.01",
  "credits_never_expire": true,
  "tools_on_credits": ["search_funds", "get_fund", "get_changes"],
  "tools_paid_per_call": {
    "get_fund_signals": "€0.10",
    "get_gp_profile": "€0.10",
    "match_startup": "€0.25"
  },
  "payment": {
    "protocol": "mpp",
    "methods": ["tempo_usdc"],
    "topup_endpoint": "/_api/agent/credits/topup",
    "daily_spend_limit": "€1000.00"
  },
  "link_email_endpoint": "/_api/agent/link",
  "mcp_endpoint": "https://fundmomentum.vc/_api/mcp"
}
```

No payment, no approval, no human: an agent registers and makes a useful call in the same second. The key is returned **once** — only a SHA-256 hash is stored, so a lost key cannot be recovered.

`operator_url` and `contact` are optional free text and are never verified. Send an `email` and it is ignored with a note rather than rejected, so callers written against the old contract keep working.

The 25 credits work on **all six tools**. Free tools cost 1 credit (€0.01); the Pro tools are priced per call.

#### Why there is no email step

An earlier release gated the Pro tools behind a clicked verification link. That was wrong for three reasons, and it is gone.

Most agents cannot read email, so it put a human step inside a flow that promises "register and call in the same second". It shared the `users` table with the human Google sign-up, so a person who had signed in with Google and then called this endpoint got back `status: "existing"`, a **null** API key, zero credits, and a response claiming all six tools were available. And it bought almost no protection anyway: throwaway addresses are free.

**Access control is pricing.** Pro data costs money per call, always, with no free path. Identity is the API key — or, for inline payments, the paying wallet.

New keys are capped at **3 per IP** and **10 per /24** per UTC day. Over that, registration answers `429` naming both escape routes rather than leaving you stuck: the keyless tools, and inline payment, neither of which needs a key.

Every agent-tier response then carries its balance in `_meta`:

```json
"_meta": {
  "credits_remaining": 24,
  "cost_per_call": "€0.01",
  "billing": "per_call"
}
```

`buy_more` is added to that block once `credits_remaining` drops below 100.

#### Paying, with no account at all

**Autonomous machine payment is live on Tempo mainnet.** A Pro tool called with **no key whatsoever** answers HTTP `402` carrying a payment challenge over [MPP](https://mpp.dev). Pay it in USDC on Tempo (chain `4217`), retry, and you get the data plus a receipt. Nothing is registered and no account exists at any point.

```bash
curl -fsSL https://tempo.xyz/install | bash
tempo wallet login
tempo request -X POST --json '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_fund_signals","arguments":{"slug":"speedinvest"}},"id":1}' https://fundmomentum.vc/_api/mcp
```

The same flow tops up a key, so an agent never has to stop:

```bash
curl -s -X POST https://fundmomentum.vc/_api/agent/credits/topup \
  -H "X-API-Key: fm_agent_..." -H "Content-Type: application/json" \
  -d '{"amount_eur":20}'
```

`amount_eur` is 5, 20, 50 or 100. €20 buys 2,000 credits. The daily ceiling is checked **before** a challenge is issued, so you are never invited to pay for something that would then be refused. Spending is capped at **€1,000 per payer per UTC day**.

Prices are quoted in EUR and settle in USDC, converted at the ECB daily reference rate plus a 1.5% buffer for intraday movement and fees. There is no rounding up to the cent: €0.01 charges $0.0118, not $0.02.

The challenge arrives on a standard `WWW-Authenticate: Payment ...` header, and a paid response carries a `Payment-Receipt` header with the on-chain reference.

**Over MCP the shape is different, because it has to be.** An MCP client ignores the body of a `402` — it decides on the status line. So a caller that speaks MCP over Streamable HTTP (an `mcp-method` header, or an `Accept` listing both `application/json` and `text/event-stream`) gets HTTP `200` carrying a JSON-RPC error instead: `error.code` `-32042`, the challenges in `error.data.challenges`, and the request `id` echoed back. Pay and retry with the credential in `params._meta["org.paymentauth/credential"]`; the receipt comes back in `result._meta["org.paymentauth/receipt"]`. A credential that does not verify answers `-32043`, never `-32042` — you are not asked to pay twice.

Checked by the protocol's own validator against this server:

```
$ mppx validate https://fundmomentum.vc
Summary: 15 passed, 0 failed, 1 skipped
```

Everything structural passes, including the mainnet token and recipient addresses. The one skip is the payment step itself: the validator provisions a funded wallet on testnet only, and mainnet has no faucet. That step passes on the identical testnet deployment, with a real on-chain payment and a verified receipt (25/25).

Out of credits used to surface as JSON-RPC error `-32001`. It is now an HTTP `402` — update any handler matching the old code.

If you would rather not pay at all, the fallback is real: drop the `X-API-Key` header and `search_funds` and `get_fund` still answer <!--fm:keyless_calls-->10<!--/fm:keyless_calls--> calls per day with no credential.

#### Linking an email (optional)

`POST /_api/agent/link` with `{"email":"..."}` attaches a key to a human account for **invoices and a dashboard only**. It grants no access and changes no credits. An address already verified — a Google sign-in, say — links immediately and no mail is sent. This endpoint and `/_api/agent/link/resend` (3/day) are the only places the agent path ever sends email.

### Quick Setup (Claude Desktop)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "fund-momentum": {
      "url": "https://fundmomentum.vc/_api/mcp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

Restart Claude Desktop. Done. Drop the `headers` block entirely to run on the keyless trial.

### Example Queries

```
"Which seed funds in DACH invest in B2B SaaS and are deploying now?"
"What is Speedinvest bullish on right now?"
"Match my startup: AI-native fintech, seed stage, raising €3M, Vienna"
"What should I know before pitching Point Nine Capital?"
"What changed in the fund database since last Monday?"
```

### Available Tools (6)

| Tool | Title | Tier | Description |
|---|---|---|---|
| `search_funds` | Search VC funds | Free | Search actively deploying funds by stage, country, industry |
| `get_fund` | Get fund profile | Free | Full fund profile with GP intelligence and a provenance block |
| `get_changes` | Get changed funds since | Free | Only the funds that changed since a timestamp — for incremental sync |
| `get_fund_signals` | Get fund investor signals | Pro | Bullish/contrarian signals, deployment status, thesis tags |
| `get_gp_profile` | Get General Partner profiles | Pro | Individual GP profiles and backgrounds |
| `match_startup` | Match startup to funds | Pro | AI-powered fund matching based on startup description |

All six tools are read-only and non-destructive, and advertise it:
`readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`.
An agent can call any of them without a confirmation prompt — nothing here mutates state.

`search_funds` and `get_fund` were previously documented as **Starter**. They are **Free**.

### Incremental sync — use `get_changes`, not a polling loop

**Do not re-run `search_funds` on a schedule.** `get_changes` exists for exactly that job and is dramatically cheaper.

The loop:

1. Call `get_changes` with a `since` timestamp. Omit `since` to get the last 7 days.
2. Keep the `next_since` and `etag` from the response.
3. Next poll, send `next_since` as `since` and the previous `etag` as `if_none_match`.
4. If nothing changed in that window, the reply is `unchanged: true` with zero rows — a few bytes instead of a full page.

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_changes",
    "arguments": {
      "since": "2026-08-20T00:00:00Z",
      "if_none_match": "\"2126d79bb6487457b97d8b05eb84253e\"",
      "limit": 50
    }
  },
  "id": 1
}
```

`since` accepts an ISO 8601 timestamp or a unix epoch in milliseconds as a string. `limit` is 1–200, default 50.

A changed window answers with the cursor fields plus the rows:

```json
{
  "since": "2026-08-20T00:00:00.000Z",
  "since_defaulted": false,
  "next_since": "2026-08-25T16:00:21.418Z",
  "returned": 2,
  "total_changed": 4,
  "has_more": true,
  "etag": "\"2126d79bb6487457b97d8b05eb84253e\"",
  "changes": [
    {
      "slug": "cloudberry-ventures-deeptech-fund",
      "name": "Cloudberry Ventures DeepTech Fund",
      "country": "United Kingdom",
      "fundingStage": "seed",
      "fundSize": "€50M",
      "change_type": "signal_updated",
      "changed_at": "2026-08-24T04:00:22.242Z",
      "confidence": "high",
      "url": "https://fundmomentum.vc/funds/cloudberry-ventures-deeptech-fund"
    }
  ]
}
```

When `has_more` is `true`, call again with the returned `next_since` before sleeping.

**Plain HTTP alternative.** The same data is on `GET /_api/changes`, with the cursor as an ordinary conditional request — keep the `ETag` response header and send it back as `If-None-Match`. An unchanged window answers `304 Not Modified` with an empty body.

### API Reference

**Endpoint:** `POST https://fundmomentum.vc/_api/mcp`
**Protocol:** JSON-RPC 2.0 over streamable HTTP
**Server card:** [`/_api/well-known/mcp/server-card`](https://fundmomentum.vc/_api/well-known/mcp/server-card)
**Auth:** `X-API-Key` header, or `Authorization: Bearer <key>` — or nothing at all on the keyless trial

```python
import requests

r = requests.post(
    "https://fundmomentum.vc/_api/mcp",
    headers={"X-API-Key": "YOUR_KEY", "Content-Type": "application/json"},
    json={
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": "search_funds",
            "arguments": {"stage": "seed", "country": "Germany", "limit": 10}
        },
        "id": 1
    }
)
print(r.json())
```

```typescript
const r = await fetch("https://fundmomentum.vc/_api/mcp", {
  method: "POST",
  headers: { "X-API-Key": "YOUR_KEY", "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    params: { name: "get_fund_signals", arguments: { slug: "speedinvest" } },
    id: 1
  })
});
const data = await r.json();
```

More in [examples/developers.md](examples/developers.md) and [examples/founders.md](examples/founders.md).

---

## GP Signal Profiles

Beyond fund size and portfolio, Fund Momentum extracts how each GP actually thinks:

- **Thesis Tags** — specific investment focus areas
- **Bullish Signals** — what they're excited about right now
- **Contrarian Signals** — where they're betting against the consensus
- **Deployment Score** — how actively they're writing checks
- **Founder Dos & Don'ts** — how to pitch this specific fund

Built from primary research: GP blog posts, fund websites, LinkedIn, published interviews. Not scraped summaries.

---

## FM15 — Founder Alignment Ranking

The FM15 is our semi-annual ranking of the 15 best **emerging** VC managers, scored on four dimensions:

| Dimension | What we measure |
|---|---|
| LP Trust Signal | LP quality, re-ups, fund size trajectory |
| Early Track Record | Portfolio performance, notable exits |
| Thesis Sharpness | Specificity and differentiation of investment focus |
| Founder Alignment | GP background, check size fit, post-investment support |

**No AUM sorting. No paid inclusion. Primary research only.**

→ [View FM15 H1 2026](https://fundmomentum.vc/fm15-2026)

---

## MCP Pricing

These tiers cover the MCP server and API only.

**Agents are not on these plans.** They pay per call — €0.01 for a free tool, €0.10–€0.25 for a Pro tool — with no subscription and no account. See [Access without registration](#access-without-registration) above. The monthly plans below are for people.

| Tier | Price | API Calls | Tools |
|---|---|---|---|
| Agents (per call) | €0.01–€0.25/call | Unmetered, pay as you go | All six tools, no account needed |
| Keyless trial | €0, no signup | <!--fm:keyless_calls-->10<!--/fm:keyless_calls-->/day per caller | `search_funds`, `get_fund` |
| Free | €0 | <!--fm:free_calls-->100<!--/fm:free_calls-->/mo | `search_funds`, `get_fund`, `get_changes` |
| Starter | €9/mo | 1,000/mo | `search_funds`, `get_fund`, `get_changes` |
| Pro | <!--fm:pro_price-->€29/mo<!--/fm:pro_price--> | 10,000/mo | All six tools incl. signals |
| Enterprise | Custom | Unlimited | All six tools, custom contract & SLA |

The keyless, Free and Pro rows are generated from the server card. The Starter
and Enterprise rows are still typed by hand — the card exposes no tier block for
them, so treat [fundmomentum.vc/pricing](https://fundmomentum.vc/pricing) as
authoritative if those two ever disagree with this table.

→ [MCP plans & client setup](https://fundmomentum.vc/mcp) · [Subscribe & get a key](https://fundmomentum.vc/pricing)

Founder and investor-signal plans for the platform itself are priced separately
→ [fundmomentum.vc/pricing](https://fundmomentum.vc/pricing)

---

## Keeping the numbers honest

Fund and LP counts, the keyless and Free allowances and the Pro price in this README are **generated, not typed**. [`scripts/sync-counts.sh`](scripts/sync-counts.sh) reads them from the live server card and rewrites the values between the `<!--fm:*-->` marker pairs, plus `version` and `description` in [`server.json`](server.json).

Two numbers are **not** covered: the **Starter** and **Enterprise** rows in the pricing table. The server card exposes `authentication.free_tier` and a Pro price via `tools[].price`, but no tier block, so there is nothing to read them from. They stay hand-typed until the card grows one — see the note at the top of [`scripts/sync-counts.sh`](scripts/sync-counts.sh) for how to wire them up when it does.

The fund count is published rounded down to the nearest hundred — `1000+` today — matching the site's own copy and the server card's note that marketing figures round the live count down. It still moves on its own as the database grows; it is simply never ahead of the truth.

```bash
scripts/sync-counts.sh
```

```bash
scripts/sync-counts.sh --check
```

[`.github/workflows/sync-counts.yml`](.github/workflows/sync-counts.yml) runs it weekly and commits any drift. [`.github/workflows/publish-mcp.yml`](.github/workflows/publish-mcp.yml) runs it before every registry publish, so a release can never ship a stale count.

To sync a number in a new spot, wrap it in a marker pair and it is picked up on the next run. The markers are invisible in rendered Markdown.

---

## Links

- **Platform:** [fundmomentum.vc](https://fundmomentum.vc)
- **MCP docs, plans & API keys:** [fundmomentum.vc/mcp](https://fundmomentum.vc/mcp)
- **Founder / investor-signal pricing:** [fundmomentum.vc/pricing](https://fundmomentum.vc/pricing)
- **Server card:** [fundmomentum.vc/_api/well-known/mcp/server-card](https://fundmomentum.vc/_api/well-known/mcp/server-card)
- **Registry:** `io.github.schneidavie/fund-momentum`
- **FM15 Ranking:** [fundmomentum.vc/fm15-2026](https://fundmomentum.vc/fm15-2026)
- **Newsletter:** [schneida.substack.com](https://schneida.substack.com)
- **Smithery:** [smithery.ai/servers/djschneida/fundmomentum](https://smithery.ai/servers/djschneida/fundmomentum)

---

*Maintained by [Michael Schneider](https://www.linkedin.com/in/schneidavie) · Vienna, Austria*
