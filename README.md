# Fund Momentum MCP Server

> 960+ active VC funds. Live investor signals. AI-powered matching.

The Fund Momentum MCP server connects Claude, Cursor, or any MCP-compatible AI to our database of active venture capital funds — all raised capital since September 2024.

[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-gold)](https://fundmomentum.vc/mcp)
[![API Version](https://img.shields.io/badge/API-v1.0-black)](https://fundmomentum.vc/_api/mcp)
[![Starter](https://img.shields.io/badge/Starter-49%2Fmo-blue)](https://fundmomentum.vc/pricing)
[![Agent](https://img.shields.io/badge/Agent-0.01%2Fcall-green)](https://fundmomentum.vc/for-agents)

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

Get your API key at [fundmomentum.vc/pricing](https://fundmomentum.vc/pricing) or register an agent key at [fundmomentum.vc/for-agents](https://fundmomentum.vc/for-agents). Restart Claude Desktop. Done.

---

## Available Tools

| Tool | Tier | Description |
|------|------|-------------|
| `search_funds` | Starter | Filter 960+ active VC funds by stage, country, industry |
| `get_fund` | Starter | Full fund profile with thesis, check size, team |
| `get_fund_signals` | Pro / Agent | Live GP signals, deployment status, founder playbook |
| `get_gp_profile` | Pro / Agent | Individual partner backgrounds, character tags, thesis |
| `match_startup` | Pro / Agent | AI matching — describe your startup, get top 10 investor matches |

---

## Pricing

| Tier | Price | Calls | Tools | Best for |
|------|-------|-------|-------|----------|
| Free | 0 | 0 manifest only | - | Browsing the API |
| Starter | 49/mo | 1,000/mo | search_funds, get_fund | Founders researching investors |
| Pro | 299/mo | 10,000/mo | All tools | Power users and small tools |
| **Agent** | **0.01/call** | **Unlimited** | **All tools** | **Autonomous agents and workflows** |
| Enterprise | Custom | Unlimited | All + SLA | Accelerators and platforms |

### Agent Tier - Credit Bundles

No subscription. Credits never expire.

| Pack | Calls | Price | Rate |
|------|-------|-------|------|
| Starter | 1,000 | 10 | 0.010/call |
| Standard | 10,000 | 80 | 0.008/call - 20% off |
| Volume | 100,000 | 500 | 0.005/call - 50% off |

Buy agent credits: https://fundmomentum.vc/for-agents

### Agent Self-Registration

Agents can register themselves without human approval:

```bash
curl -X POST https://fundmomentum.vc/_api/agent/register \
  -H "Content-Type: application/json" \
  -d '{"agent_name": "my-workflow", "email": "ops@yourcompany.com"}'
```

Response:

```json
{
  "api_key": "abc123...",
  "agent_credits": 0,
  "status": "registered",
  "mcp_endpoint": "https://fundmomentum.vc/_api/mcp"
}
```

Every MCP response includes credit balance:

```json
{
  "_meta": {
    "credits_remaining": 9847,
    "cost_per_call": "0.01",
    "billing": "per_call"
  }
}
```

When credits run out, the MCP returns:

```json
{
  "error": {
    "code": -32001,
    "message": "Insufficient credits. Buy more at https://fundmomentum.vc/for-agents",
    "buy_url": "https://fundmomentum.vc/for-agents"
  }
}
```

---

## Example Prompts (Claude Desktop)

**For founders:**
```
Which seed funds in Austria invest in B2B SaaS?
What is Speedinvest bullish on right now?
Match my startup: AI-native fintech, seed stage, raising 3M, Vienna
What should I know before pitching Point Nine Capital?
Show me active pre-seed funds in the UK focused on deep tech
```

**For developers and agents:**
```
Search for 20 seed funds in Germany and return as JSON
Get the GP signal profile for Accel latest fund
Match this description to investors: [paste startup description]
```

---

## API Reference

**Endpoint:** POST https://fundmomentum.vc/_api/mcp  
**Protocol:** JSON-RPC 2.0  
**Auth:** X-API-Key header

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

**Arguments:** stage, country, industry, limit (max 20)

Stage values: pre_seed, seed, series_a, series_b, series_c, growth, late_stage

### get_fund (Starter)

Full fund profile including name, country, fundingStage, fundSize, website, linkedin, fundManager, description, industries. Pro and Agent tiers also receive signal data.

### get_fund_signals (Pro / Agent)

Returns: thesisTags, bullishSignals, contrarianSignals, founderDos, founderDonts, sweetSpot, activeStatus, deploymentProgress, freshnessScore (1-10), lastUpdated

### get_gp_profile (Pro / Agent)

Returns: name, initials, role, characterTags, knownFor, linkedinUrl

### match_startup (Pro / Agent)

```python
r = requests.post(url, headers=headers, json={
    "jsonrpc": "2.0", "method": "tools/call",
    "params": {
        "name": "match_startup",
        "arguments": {
            "description": "B2B SaaS for estate management, DACH, pre-seed, raising 500K",
            "stage": "pre_seed",
            "country": "Austria"
        }
    }, "id": 1
})
# Returns top 10 matches with name, slug, match_reason, match_score, url
```

---

## n8n Integration

HTTP Request Node, Method POST, URL https://fundmomentum.vc/_api/mcp, Header X-API-Key from env.

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": { "name": "search_funds", "arguments": { "stage": "seed", "limit": 20 } },
  "id": 1
}
```

---

## Compatible With

LangChain, CrewAI, n8n, AutoGPT, LangGraph, OpenAI Agents SDK, Claude, Any MCP Client

---

## Links

- Website: https://fundmomentum.vc
- MCP Overview: https://fundmomentum.vc/mcp
- For Agents: https://fundmomentum.vc/for-agents
- Pricing: https://fundmomentum.vc/pricing
- GitHub examples: https://github.com/schneidavie/fundmomentum/tree/main/examples
- Contact: michael@fundmomentum.vc

---

Fund Momentum tracks 960+ active VC funds raised since September 2024.
