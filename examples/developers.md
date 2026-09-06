# Developer Examples

Endpoint: `POST https://fundmomentum.vc/_api/mcp` · JSON-RPC 2.0 over streamable HTTP
Auth: `X-API-Key: <key>`, or `Authorization: Bearer <key>`, or nothing at all on the keyless trial.

## No API key at all

`search_funds` and `get_fund` answer <!--fm:keyless_calls-->10<!--/fm:keyless_calls--> calls per caller per UTC day with no credential. Start here.

```bash
curl -s https://fundmomentum.vc/_api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_funds","arguments":{"stage":"seed","country":"Germany","limit":5}},"id":1}'
```

Once you hit the daily cap, a free key raises it to <!--fm:free_calls-->100<!--/fm:free_calls--> calls/month and unlocks `get_changes`. Humans subscribe and copy a key at [fundmomentum.vc/pricing](https://fundmomentum.vc/pricing); [fundmomentum.vc/mcp](https://fundmomentum.vc/mcp) has the plans and client setup. Agents can self-register:

```bash
curl -s https://fundmomentum.vc/_api/agent/register \
  -H "Content-Type: application/json" \
  -d '{"agent_name":"your-agent-name","email":"you@example.com"}'
```

That returns `201` with `"api_key"` **and `"agent_credits": 25`** — no payment, no approval step, so
an agent can register and make a useful call in the same second. Those credits work immediately on
`search_funds`, `get_fund` and `get_changes`. Clicking the verification link in the registration
email unlocks `get_fund_signals`, `get_gp_profile` and `match_startup` on the same 25 credits — free,
one click, not an upgrade. Calling a locked tool before that answers `403` with
`error_reason: "email_verification_required"`.

Re-registering an existing address returns `200`, `"status": "existing"` and the current balance,
not another 25 — matched on the normalised mailbox, so `+tag` and dotted Gmail aliases resolve to
the same account. New accounts are capped at 3 per IP per UTC day (`429` beyond that); repeat
registrations of an existing address do not count against the cap.

Beyond the free 25 it is €0.01/call and credits never expire. An exhausted balance answers
**HTTP `402`** (previously JSON-RPC `-32001`) carrying `autonomous_payment_available: false`:
top-ups go through Stripe Checkout and need a human once. An agent cannot pay for itself — machine
payment (MPP / x402) is planned but **not live**. The 402 payload also names the fallback: drop the
`X-API-Key` header and the keyless allowance still answers `search_funds` and `get_fund`.

## Python — Search Funds

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

`stage` and `industry` are enums — lowercase with underscores (`pre_seed`, `series_a`, `ai_ml`,
`climate_sustainability`). Common spellings like `Pre-Seed` or `AI/ML` are normalised. `country` is
spelled out in full (`United States`), not an ISO code. `slug` values are not derivable from a fund's
display name, so call `search_funds` before `get_fund` rather than guessing.

## Python — Incremental sync with get_changes

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

## HTTP — Incremental sync without MCP

The same data is on `GET /_api/changes` as an ordinary conditional request. Keep the `ETag` response
header, send it back as `If-None-Match`, and an unchanged window answers `304 Not Modified` with an
empty body.

```bash
curl -s -D - -o /dev/null \
  -H 'If-None-Match: "2126d79bb6487457b97d8b05eb84253e"' \
  "https://fundmomentum.vc/_api/changes?since=2026-08-20T00:00:00Z&limit=50"
```

## Python — Match Startup

```python
matches = mcp_call("match_startup", {
    "description": "B2B SaaS for estate management and notaries. AI document processing. DACH market. Pre-seed, raising €500K.",
    "stage": "pre_seed",
    "country": "Austria"
})
for m in matches.get("matches", []):
    print(f"{m['match_score']}/100 — {m['name']}: {m['match_reason']}")
```

## JavaScript — Get Fund Signals

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

const signals = await getFundSignals("speedinvest");
console.log(signals.thesisTags);
console.log(signals.founderDos);
```

## n8n Workflow

For a scheduled workflow, poll `get_changes` — not `search_funds`.

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

## Check Call Usage

Quota lives in the `_meta` block of every response — note the leading underscore. Its **shape
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
when a monthly quota is exhausted, `401` for an unrecognised key.

## Tool reference

| Tool | Title | Tier | Key arguments |
|---|---|---|---|
| `search_funds` | Search VC funds | Free | `stage`, `country`, `industry`, `limit` (1–20, default 10) |
| `get_fund` | Get fund profile | Free | `slug` (required) |
| `get_changes` | Get changed funds since | Free | `since`, `if_none_match`, `limit` (1–200, default 50) |
| `get_fund_signals` | Get fund investor signals | Pro | `slug` (required) |
| `get_gp_profile` | Get General Partner profiles | Pro | `fund_slug` (required), `gp_name` |
| `match_startup` | Match startup to funds | Pro | `description` (required, max 500 chars), `stage`, `country` |

All six are `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`,
`openWorldHint: false` — safe for an agent to call unattended.

The authoritative, always-current version of this table is the
[server card](https://fundmomentum.vc/_api/well-known/mcp/server-card).
