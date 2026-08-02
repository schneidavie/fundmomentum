# Fund Momentum — Live VC Intelligence Platform

> 1000+ actively deploying VC funds · GP Signal Profiles · FM15 Ranking · MCP Server for AI agents

**[fundmomentum.vc](https://fundmomentum.vc)** · [MCP Docs](https://fundmomentum.vc/mcp) · [FM15 Ranking](https://fundmomentum.vc/fm15-2026) · [Smithery](https://smithery.ai/servers/djschneida/fundmomentum)

---

## What is Fund Momentum?

Fund Momentum is a live VC intelligence platform built for founders raising capital. We track **985+ actively deploying VC funds** — all raised capital since September 2024 — with weekly-updated GP Signal Profiles that go beyond fund basics.

**The problem:** Most VC databases are graveyard tours. Funds that stopped deploying 18 months ago, GPs who moved on, theses that haven't been updated since the fund closed. Founders pitch 40 investors and discover half of them aren't writing checks anymore.

**The solution:** Fund Momentum only lists funds that raised capital since September 2024. Every fund has verified deployment signals, not scraped summaries.

---

## MCP Server

Connect Claude, Cursor, or any MCP-compatible AI directly to Fund Momentum.

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

Get your API key at **[fundmomentum.vc/account-settings](https://fundmomentum.vc/account-settings)**. Restart Claude Desktop. Done.

### Example Queries

```
"Which seed funds in DACH invest in B2B SaaS and are deploying now?"
"What is Speedinvest bullish on right now?"
"Match my startup: AI-native fintech, seed stage, raising €3M, Vienna"
"What should I know before pitching Point Nine Capital?"
"Show me active pre-seed funds in the UK focused on deep tech"
```

### Available Tools (5)

| Tool | Tier | Description |
|---|---|---|
| `search_funds` | Starter | Search 985+ funds by stage, country, industry |
| `get_fund` | Starter | Full fund profile with GP intelligence |
| `get_fund_signals` | Pro | Bullish/contrarian signals, deployment status, thesis tags |
| `get_gp_profile` | Pro | Individual GP profiles and backgrounds |
| `match_startup` | Pro | AI-powered fund matching based on startup description |

### API Reference

**Endpoint:** `POST https://fundmomentum.vc/_api/mcp`  
**Protocol:** JSON-RPC 2.0  
**Auth:** `X-API-Key` header or `Authorization: Bearer <key>`

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

## Pricing

| Tier | Price | API Calls | Access |
|---|---|---|---|
| Free | €0 | — | Platform browsing |
| Starter | €49/mo | 1,000/mo | search_funds, get_fund |
| Pro | €299/mo | 10,000/mo | All tools incl. signals |
| Agent | €0.01/call | Pay-per-call | All tools, credit-based |

→ [Get API Key](https://fundmomentum.vc/account-settings) · [Pricing](https://fundmomentum.vc/pricing)

---

## Links

- **Platform:** [fundmomentum.vc](https://fundmomentum.vc)
- **MCP Docs:** [fundmomentum.vc/mcp](https://fundmomentum.vc/mcp)
- **FM15 Ranking:** [fundmomentum.vc/fm15-2026](https://fundmomentum.vc/fm15-2026)
- **Newsletter:** [schneida.substack.com](https://schneida.substack.com)
- **Smithery:** [smithery.ai/servers/djschneida/fundmomentum](https://smithery.ai/servers/djschneida/fundmomentum)

---

*Maintained by [Michael Schneider](https://www.linkedin.com/in/schneidavie) · Vienna, Austria*
