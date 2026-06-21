# Fund Momentum MCP Server

> 960+ active VC funds. Live investor signals. AI-powered matching.

The Fund Momentum MCP server connects Claude, Cursor, or any MCP-compatible AI to our database of active venture capital funds — all raised capital since September 2024.

[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-gold)](https://fundmomentum.vc/mcp)
[![API Version](https://img.shields.io/badge/API-v1.0-black)](https://fundmomentum.vc/_api/mcp)
[![Starter](https://img.shields.io/badge/Starter-€49%2Fmo-blue)](https://fundmomentum.vc/pricing)

---

## Quickstart

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

Get your API key at [fundmomentum.vc/pricing](https://fundmomentum.vc/pricing). Restart Claude Desktop. Done.

---

## Available Tools

| Tool | Tier | Description |
|------|------|-------------|
| `search_funds` | Starter | Filter 960+ active VC funds by stage, country, industry |
| `get_fund` | Starter | Full fund profile with thesis, check size, team |
| `get_fund_signals` | Pro | Live GP signals, deployment status, founder playbook |
| `get_gp_profile` | Pro | Individual partner backgrounds, character tags, thesis |
| `match_startup` | Pro | AI matching — describe your startup, get top 10 investor matches |

---

## Example Prompts (Claude Desktop)

**For founders:**
```
"Which seed funds in Austria invest in B2B SaaS?"
"What is Speedinvest bullish on right now?"
"Match my startup: AI-native fintech, seed stage, raising €3M, Vienna"
"What should I know before pitching Point Nine Capital?"
"Show me active pre-seed funds in the UK focused on deep tech"
```

**For developers:**
```
"Search for 20 seed funds in Germany and return as JSON"
"Get the GP signal profile for Accel's latest fund"
"Match this description to investors: [paste startup description]"
```

---

## API Reference

**Endpoint:** `POST https://fundmomentum.vc/_api/mcp`  
**Protocol:** JSON-RPC 2.0  
**Auth:** `X-API-Key` header

### search_funds

```python
import requests

r = requests.post(
    "https://fundmomentum.vc/_api/mcp",
    headers={"X-API-Key": "YOUR_KEY", "Content-Type": "application/json"},
    json={
        "jsonrpc": "2.0", "method": "tools/call",
        "params": {
            "name": "search_funds",
            "arguments": {"stage": "seed", "country": "Germany", "limit": 10}
        },
        "id": 1
    }
)
funds = r.json()["result"]["content"][0]["text"]
```

**Arguments:**
- `stage`: `pre_seed` | `seed` | `series_a` | `series_b` | `series_c` | `growth` | `late_stage`
- `country`: string (e.g. "Austria", "Germany", "United Kingdom")
- `industry`: string (e.g. "fintech", "ai_ml", "deep_tech", "saas")
- `limit`: number, max 20

---

### get_fund

```javascript
const r = await fetch("https://fundmomentum.vc/_api/mcp", {
  method: "POST",
  headers: {"X-API-Key": "YOUR_KEY", "Content-Type": "application/json"},
  body: JSON.stringify({
    jsonrpc: "2.0", method: "tools/call",
    params: { name: "get_fund", arguments: { slug: "speedinvest" } },
    id: 1
  })
});
const fund = await r.json();
```

**Arguments:**
- `slug`: Fund slug from `search_funds` results (required)

**Returns:** name, country, stage, fundSize, website, linkedin, fundManager, description, industries, url. Pro tier adds: activeStatus, deploymentProgress, sweetSpot, thesisTags, freshnessScore.

---

### get_fund_signals (Pro)

```python
r = requests.post(url, headers=headers, json={
    "jsonrpc": "2.0", "method": "tools/call",
    "params": {"name": "get_fund_signals", "arguments": {"slug": "point-nine-capital"}},
    "id": 1
})
```

**Returns:** thesisTags, bullishSignals, contrarianSignals, founderDos, founderDonts, sweetSpot, activeStatus, deploymentProgress, freshnessScore (1-10), lastUpdated

---

### get_gp_profile (Pro)

```python
r = requests.post(url, headers=headers, json={
    "jsonrpc": "2.0", "method": "tools/call",
    "params": {
        "name": "get_gp_profile",
        "arguments": {"fund_slug": "speedinvest", "gp_name": "André"}
    },
    "id": 1
})
```

**Arguments:**
- `fund_slug`: required
- `gp_name`: optional — filter to specific GP if fund has multiple

**Returns:** name, initials, role, characterTags, knownFor, linkedinUrl

---

### match_startup (Pro)

```python
r = requests.post(url, headers=headers, json={
    "jsonrpc": "2.0", "method": "tools/call",
    "params": {
        "name": "match_startup",
        "arguments": {
            "description": "B2B SaaS for estate management, DACH, pre-seed, raising €500K",
            "stage": "pre_seed",
            "country": "Austria"
        }
    },
    "id": 1
})
matches = r.json()["result"]["content"][0]["text"]
```

**Arguments:**
- `description`: string, max 500 chars (required)
- `stage`: optional filter
- `country`: optional filter

**Returns:** Array of top 10 matches with name, slug, match_reason (max 12 words), match_score (0-100), url

---

## Response Format

Every `tools/call` response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      { "type": "text", "text": "{...json result...}" }
    ],
    "meta": {
      "calls_used": 42,
      "calls_limit": 1000,
      "calls_remaining": 958
    }
  }
}
```

Error response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32001,
    "message": "Insufficient tier. Required: starter (€49/mo). Upgrade at https://fundmomentum.vc/mcp"
  }
}
```

---

## Pricing

| Tier | Price | Calls/month | Tools |
|------|------|-------------|-------|
| Free | €0 | 0 (manifest only) | - |
| Starter | €49/mo | 1,000 | search_funds, get_fund |
| Pro | €299/mo | 10,000 | All tools incl. signals & matching |
| Enterprise | Custom | Unlimited | All tools + SLA + webhooks |

[Get your API key →](https://fundmomentum.vc/pricing)

---

## n8n Integration

HTTP Request Node:
- **Method:** POST
- **URL:** `https://fundmomentum.vc/_api/mcp`
- **Header:** `X-API-Key: {{ $env.FM_API_KEY }}`
- **Body:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "search_funds",
    "arguments": { "stage": "seed", "limit": 20 }
  },
  "id": 1
}
```

---

## Manifest

```
GET https://fundmomentum.vc/_api/mcp
```

Returns full manifest with all tools, pricing, and Claude Desktop config.

---

## Links

- **Website:** [fundmomentum.vc](https://fundmomentum.vc)
- **MCP Landing Page:** [fundmomentum.vc/mcp](https://fundmomentum.vc/mcp)
- **Pricing:** [fundmomentum.vc/pricing](https://fundmomentum.vc/pricing)
- **Privacy Policy:** [fundmomentum.vc/privacy](https://fundmomentum.vc/privacy)
- **Contact:** michael@fundmomentum.vc

---

*Fund Momentum tracks 960+ active VC funds. All funds raised capital since September 2024.*
# 🧠 Fund Momentum – VC & PE Tracker (Sep 2024–May 2025 Edition)

This is the open-data dataset maintained by **Fund Momentum**, your go-to resource for discovering fresh VC & PE funds **actively deploying capital**.

---

## 📊 What’s Included?

- 140+ verified VC/PE funds
- Fund Size & Currency
- Stage & Industry Focus
- Team LinkedIn Contacts
- Website URLs
- Hiring Status (for talent)

---

## 💼 Use Cases

- 🚀 **Founders**: Identify funds actively deploying in Q1/Q2 2025
- 🧠 **Job Seekers**: Find funds currently hiring
- 🤝 **VCs/PEs**: Spot co-investors and fund-of-fund targets

---

## 🔗 Files

| File | Description |
|------|-------------|
| `index.html` | Live HTML view (loads all funds from JSON) |
| `fund_momentum_sep2024_may2025.json` | Structured JSON for AI tools, LLMs, and LangChain apps |
| `fund_momentum_sep2024_may2025.csv` | Spreadsheet format |
| `README.md` | This file – overview and guidance |

---

## 🤖 Optimized for AI & Agents

This repo is built for:
- LLM ingestion (ChatGPT, Claude, Gemini)
- AI agents and LangChain apps
- CRM enrichment
- Deal sourcing automations

---

📫 Subscribe: [seedraisr.substack.com](https://seedraisr.substack.com)  
🔗 Maintained by [@schneidavie](https://www.linkedin.com/in/schneidavie)
