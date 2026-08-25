# Fund Momentum — Live VC Intelligence Platform

> <!--fm:funds-->1000+<!--/fm:funds--> actively deploying VC funds · <!--fm:lps-->367<!--/fm:lps--> disclosed LPs · GP Signal Profiles · FM15 Ranking · MCP Server for AI agents

**[fundmomentum.vc](https://fundmomentum.vc)** · [MCP Docs](https://fundmomentum.vc/mcp) · [FM15 Ranking](https://fundmomentum.vc/fm15-2026) · [Smithery](https://smithery.ai/servers/djschneida/fundmomentum)

---

## What is Fund Momentum?

Fund Momentum is a live VC intelligence platform built for founders raising capital. We track **<!--fm:funds-->1000+<!--/fm:funds--> actively deploying VC funds** — all raised capital since September 2024 — plus **<!--fm:lps-->367<!--/fm:lps--> disclosed institutional LPs**, with weekly-updated GP Signal Profiles that go beyond fund basics.

**The problem:** Most VC databases are graveyard tours. Funds that stopped deploying 18 months ago, GPs who moved on, theses that haven't been updated since the fund closed. Founders pitch 40 investors and discover half of them aren't writing checks anymore.

**The solution:** Fund Momentum only lists funds that raised capital since September 2024. Every fund has verified deployment signals, not scraped summaries, and every fund profile carries a provenance block naming its source, last verification date and confidence.

> The counts above are generated, not typed. [`scripts/sync-counts.sh`](scripts/sync-counts.sh)
> reads a live `SELECT COUNT(*)` from the [server card](https://fundmomentum.vc/_api/well-known/mcp/server-card)
> and rounds the fund count down, so the published figure is always an
> understatement rather than a stale boast — see [Keeping the numbers honest](#keeping-the-numbers-honest).

---

## MCP Server

Connect Claude, Cursor, or any MCP-compatible AI directly to Fund Momentum.

### Try it with no API key

`search_funds` and `get_fund` answer **<!--fm:keyless_calls-->10<!--/fm:keyless_calls--> calls per caller per UTC day with no credential at all**. No signup, no card, no key. This is the front door — see real data before you decide anything.

```bash
curl -s https://fundmomentum.vc/_api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_funds","arguments":{"stage":"seed","country":"Germany","limit":5}},"id":1}'
```

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

### Getting a key

Both routes are free and take under a minute.

**Humans:** [fundmomentum.vc/mcp](https://fundmomentum.vc/mcp) — MCP plans and keys live here, not on the main pricing page.

**Autonomous agents:** self-register and get a key back in the same response.

```bash
curl -s https://fundmomentum.vc/_api/agent/register \
  -H "Content-Type: application/json" \
  -d '{"agent_name":"your-agent-name","email":"you@example.com"}'
```

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

| Tier | Price | API Calls | Tools |
|---|---|---|---|
| Keyless trial | €0, no signup | <!--fm:keyless_calls-->10<!--/fm:keyless_calls-->/day per caller | `search_funds`, `get_fund` |
| Free | €0 | <!--fm:free_calls-->100<!--/fm:free_calls-->/mo | `search_funds`, `get_fund`, `get_changes` |
| Pro | <!--fm:pro_price-->€29/mo<!--/fm:pro_price--> | 10,000/mo | All six tools incl. signals |
| Agent | €0.01/call | Pay-per-call | All six tools, credit-based |

→ [MCP plans & API keys](https://fundmomentum.vc/mcp)

Founder and investor-signal plans for the platform itself are priced separately
→ [fundmomentum.vc/pricing](https://fundmomentum.vc/pricing)

---

## Keeping the numbers honest

Fund and LP counts, tier allowances and the Pro price in this README are **generated, not typed**. [`scripts/sync-counts.sh`](scripts/sync-counts.sh) reads them from the live server card and rewrites the values between the `<!--fm:*-->` marker pairs, plus `version` and `description` in [`server.json`](server.json).

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
