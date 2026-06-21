# Developer Examples

## Python — Search Funds

```python
import requests
import json

API_KEY = "YOUR_API_KEY"
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
    print(f"{fund['name']} | {fund['country']} | {fund['stage']}")
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

1. HTTP Request Node (POST `https://fundmomentum.vc/_api/mcp`)
2. Header: `X-API-Key: {{ $env.FM_API_KEY }}`
3. Body:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "search_funds",
    "arguments": {
      "stage": "seed",
      "country": "{{ $json.country }}",
      "limit": 20
    }
  },
  "id": 1
}
```
4. JSON Parse Node: parse `result.content[0].text`
5. Loop Item Node: iterate over funds

## Check Call Usage

```python
# Meta is included in every response
result = r.json()["result"]
meta = result.get("meta", {})
print(f"Calls used: {meta['calls_used']}/{meta['calls_limit']}")
print(f"Remaining: {meta['calls_remaining']}")
```
