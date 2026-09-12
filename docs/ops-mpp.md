# Operating machine payments (MPP)

Runbook for the pay-per-call path. Everything here assumes access to the Floot
project and the Stripe dashboard.

## Environment

| Variable | Purpose |
|---|---|
| `MPP_USE_SANDBOX` | `true` selects the sandbox set below. **Unset means live.** |
| `STRIPE_SECRET_KEY_TEST` | Sandbox key (`sk_test_…`), only read in sandbox mode |
| `STRIPE_PROFILE_ID_TEST` | Sandbox Machine Payments profile (`profile_test_…`) |
| `TEMPO_DEPOSIT_ADDRESS_TEST` | Sandbox Tempo address (testnet) |
| `STRIPE_SECRET_KEY` | Live key. Shared with the subscription code. |
| `STRIPE_PROFILE_ID` | Live profile id. Optional -- defaults to the account constant in `helpers/mppCharge`. |
| `TEMPO_DEPOSIT_ADDRESS` | Live Tempo address (**mainnet -- real funds**). Optional, same default. |
| `MPP_ENABLED` | `false` disables payments entirely |
| `MPP_DAILY_LIMIT_EUR_PER_PAYER` | Default 1000 |
| `MPP_DAILY_LIMIT_EUR_GLOBAL` | Default 100000. Blast radius, not a wallet guard — see below. |

`livemode` is derived from the key itself (`sk_test_` -> testnet), exactly as
Stripe's own sample does, so a test key cannot produce a mainnet challenge.

**The two sets are read as a unit and never mixed.** Sandbox mode takes all
three values from `*_TEST`; live mode takes none of them. This is deliberate.
It used to be per-variable precedence -- any `*_TEST` that existed won -- and
during the go-live the live profile id and the mainnet deposit address were
entered under the `*_TEST` names while `STRIPE_SECRET_KEY_TEST` still held a
test key. The result was testnet challenges (chainId 42431) naming a mainnet
recipient: nothing paid against them could ever have settled, and only the
config check noticed. A test key outside sandbox mode is now refused outright.

**Going live therefore means: do not set `MPP_USE_SANDBOX`.** Leftover `*_TEST`
variables are simply ignored, so a half-finished cleanup cannot break anything.

## Health check

`GET /_api/debug/mpp-config-check` reports, without ever exposing a secret:

- whether the stored key still authenticates (a `401` means it was rolled)
- the profile id Stripe itself reports, and whether it matches what is stored
- whether the Tempo address is owned by that account, and its `livemode`
- a live challenge dry run — **`http_status: 402` is success**

Run it first for any payment problem. It distinguishes "misconfigured" from
"broken" in one request.

## Going live

**Prerequisite: the `crypto_payments` capability must be active in livemode.** A
sandbox has it by default, the live account does not, so everything passes in
test and then `/v1/crypto/deposit_addresses` answers *"The crypto_payments
capability must be active on your account to use this endpoint."* It is switched
on by enabling **Stablecoins and Crypto** under Settings -> Payment methods **with
the dashboard in live mode** -- a separate toggle from the test-mode one, and easy
to leave unset after building the integration against a sandbox. If that toggle is
already on and the error persists, only Stripe can clear it: ask them, naming the
account id and the request id from the error.

1. Confirm `mppx validate` passes against the sandbox.
2. Create a **mainnet** deposit address on the live account:
   ```bash
   curl.exe https://api.stripe.com/v1/crypto/deposit_addresses \
     -u "sk_live_YOUR_KEY:" -H "Stripe-Version: 2026-07-29.preview" -d network=tempo
   ```
3. Record both values. Either set `TEMPO_DEPOSIT_ADDRESS` and `STRIPE_PROFILE_ID`,
   or update `LIVE_DEPOSIT_ADDRESS` / `LIVE_PROFILE_ID` in `helpers/mppCharge`.
   Neither is a secret: the address is broadcast in every challenge.
4. Update the token contract address in `static/openapi.json`. It is
   NETWORK-SPECIFIC and differs between testnet and mainnet -- read it from
   `supported_tokens[].token_contract_address` on the deposit address object.
5. Make sure `MPP_USE_SANDBOX` is **not** set. Leftover `*_TEST` variables need
   no cleanup; they are ignored outside sandbox mode.
6. Re-run the health check. It must report `mode: "live"`, `mpp_livemode: true`,
   `deposit_address_livemode: true`, and no problems.
7. Leave the spend ceilings alone unless you have a reason. `MPP_ENABLED=false`
   is the real kill switch; the global ceiling is a blast radius.

## Rotating the Tempo deposit address

Create a new one (step 2 above), update `TEMPO_DEPOSIT_ADDRESS`, verify with the
health check. Existing unpaid challenges reference the **old** address and will
still settle there — do not decommission it until outstanding challenges have
expired (challenge TTL is minutes, not days).

Never create deposit addresses on the request path. It is a one-time setup call.

## The global spend ceiling

`MPP_DAILY_LIMIT_EUR_GLOBAL` does not cap any loss -- payments flow in, not out.
What it caps is how many distinct payers an undetected settlement fault can
affect in one UTC day: at 100000 against a 1000 per-payer limit, up to a hundred
rather than one. It is set high on purpose, because at low volume a tight
ceiling is likelier to refuse a genuine customer than to contain anything.
Lower it deliberately if settlement looks wrong; `MPP_ENABLED=false` is the
harder stop. When the ceiling is exceeded, challenges answer `503
payments_paused` with a `resets_at`. Check what actually settled before moving
it in either direction:

```sql
SELECT created_at::date AS day, kind, COUNT(*), SUM(amount_eur) AS eur
  FROM agent_payments GROUP BY 1, 2 ORDER BY 1 DESC LIMIT 14;
```

## Revoking a key

```sql
UPDATE agents SET revoked_at = now(), revoked_reason = 'why' WHERE id = 'agt_...';
```

Every subsequent call answers `401 key_revoked`. Credits are left intact so the
balance survives if the revocation is reversed.

To find a key by behaviour rather than id:

```sql
SELECT a.id, a.agent_name, a.credits, a.trust_score, COUNT(v.slug) AS distinct_funds_today
  FROM agents a
  LEFT JOIN agent_slug_views v
    ON v.subject_key = 'agent:' || a.id
   AND v.usage_day = (now() AT TIME ZONE 'utc')::date
 GROUP BY a.id ORDER BY distinct_funds_today DESC LIMIT 20;
```

## Where receipts live

Every settled payment writes one `agent_payments` row: `receipt_id` (unique,
the idempotency key), `amount_eur`, `amount_usd`, `fx_rate`, `kind`
(`topup` | `inline_call`) and `tool_name`. In Stripe they appear under
**Payments**, originating from the crypto deposit address.

`receipt_id` is `UNIQUE`, so a credential presented twice inserts once and the
second attempt answers `409 receipt_already_used`.

## Currency

Prices are EUR everywhere. Challenges are USDC, converted at the ECB daily
reference rate (cached 6h in `fx_rates`) plus a **1.5% buffer** for intraday
movement and settlement fees. There is no rounding up to the cent: €0.01 charges
$0.0118, not $0.02, because ceiling would be a 69% markup on the cheapest call.

If the ECB is unreachable and no rate is cached, payment endpoints answer `503
fx_unavailable` rather than guessing a rate.

## Two platform rules you must not break

Both of these look like platform bugs when you hit them. Neither is. An earlier
version of this file recorded them as blocking constraints and drafted a support
request; that was wrong, and the guide `auth-and-payment-challenges` documents
both. Recorded here so nobody re-derives the wrong conclusion.

### 1. Never return a real 402 — return 200 and let the edge do it

A Floot backend **cannot send `WWW-Authenticate` directly**. AWS renames it to
`x-amzn-remapped-www-authenticate` on the way out, on every status code. Floot
repairs this at the CDN, but the edge step only runs on responses that leave the
Lambda as **2xx** — AWS skips it entirely once the app has marked the response
`>= 400`.

So `helpers/paymentChallengeResponse.tsx` returns **`status: 200`** with:

```
x-floot-status: 402
x-floot-www-authenticate: Payment id="…", realm="…", method="tempo", intent="charge"
```

The client receives a genuine `402` with a standard `WWW-Authenticate`, and
neither `x-floot-*` header is visible to it. `Content-Type` is preserved, so
`application/problem+json` survives.

**Do not** "fix" a missing challenge by duplicating it into a custom header or
the JSON body. That was tried; stock wallets read only `WWW-Authenticate`, so it
helps only clients you can reach in advance, and `mppx validate` reports the
endpoint as *"Not an MPP endpoint"*.

### 2. Root-path discovery documents are static files

`/openapi.json` is served from **`static/openapi.json`**. Endpoints live under
`/_api/` and cannot serve a root path, and endpoint route names reject `.`, so do
not try to build one as an endpoint.

That file is hand-maintained. If `MCP_TOOLS` or `helpers/agentPricing` change,
update its tool enum and `x-payment-info` offers to match. Two details the
validator is strict about: `amount` must be a **smallest-unit integer string**
(6 decimals for USDC, so €0.10 ≈ `"120000"`), and `currency` must be the **token
contract address**, not a currency code.

### 3. Never pass `currency` to `mppx.charge()`

On an EVM rail, `currency` is a token contract address. mppx resolves the right
one from the configured deposit address. Passing `currency: "usd"` — which is
correct in Stripe's SPT sample — overrides that with a value that is not an
address, and every wallet then fails with `Address "usd" is invalid`. Omit it.

### Current state

```
$ npx mppx@latest validate https://fundmomentum.vc
Summary: 25 passed
```

Including a real on-chain payment and a verified `Payment-Receipt`. That run
proves TESTNET only.

**Live since 2026-09-10.** The health check reports `mode: "live"`,
`mpp_livemode: true`, `deposit_address_livemode: true` and no problems, and
challenges carry Tempo mainnet `chainId 4217` with the mainnet USDC token
address.

The validator was re-run against mainnet:

```
Summary: 15 passed, 1 skipped
```

Everything checkable without funds passes, including **`Valid currency address
(mainnet)`** and a valid recipient -- the two values most likely to be wrong
after a network switch, and the ones a testnet run cannot prove. The skip is
`Payment [tempo]: no wallet configured`.

**The mppx wallet commands do not run on Windows.** `mppx account list` answers
`Unsupported platform: win32`, so the payment leg cannot be exercised from a
Windows machine at all -- installing Node does not help. Closing that last gap
needs a Linux or macOS host (WSL counts) plus real USDC on Tempo, since mainnet
has no faucet. Do NOT do it on a throwaway VM: the account key dies with the
machine and any unspent balance goes with it, and exporting the key to move it
means handling a funded private key in a chat transcript.

Until then the evidence is: 25/25 on testnet including a real on-chain payment
and a verified receipt, plus 15/15 of the structural checks on mainnet. The
unproven step is settlement against the live Stripe account -- watch the first
real payment land in `agent_payments` and on the Stripe balance.

## When payments break

1. `GET /_api/debug/mpp-config-check`.
2. `get_logs` for `[mpp]`, `[billing]`, `[topup]`, `[eurUsdRate]`.
3. If the payment stack fails to load entirely, paid tools answer `503
   payments_unavailable` and **free traffic is unaffected** — payments are
   imported on demand precisely so an outage cannot take down the whole server.
4. `MPP_ENABLED=false` disables payments cleanly if needed.

## Two transports, two challenge formats

A challenge that is perfectly correct over HTTP can still be invisible to the
callers that actually matter. This endpoint issued 55 challenges in seven days
and took zero payments, with `mppx validate` passing the whole time.

The HTTP surface was never wrong. The body was: a bare RFC 9457 problem
document with no `jsonrpc`, no `id` and no `error`. 51 of the 55 challenges were
for `get_fund_signals`, which is reached almost only over MCP, so every one of
them went to a client that could not parse it as a response to its own request.

**A 402 cannot carry an MCP challenge.** mppx's client protocol returns early on
the status line, before reading the body:

```js
// The 402 schemes own status 402; MCP challenges arrive in a normal 200 body.
if (response.status === paymentRequiredStatus || id === undefined) return []
```

So the two audiences need opposite responses and `endpoints/mcp_POST.ts`
branches on the transport. `helpers/mcpPayment.isMcpTransport` reproduces mppx's
own test — an `mcp-method` header, or an `Accept` listing both
`application/json` and `text/event-stream`.

| Caller | Status | Where the challenge lives |
|---|---|---|
| Plain HTTP wallet | `402` | `WWW-Authenticate: Payment …` |
| MCP over Streamable HTTP | `200` | JSON-RPC `error.code -32042`, challenges in `error.data.challenges` |

Three details the client validates and silently discards the challenge over:

- `error.data.challenges` must be a **non-empty array** of objects passing
  `Challenge.Schema`. Not the problem document, not a single object.
- The response `id` must equal the request `id`. `paymentRequiredChallenges`
  begins `if (message.id !== id) return []`.
- `error.data._meta[...]` is **not** a path anything reads. `paymentRequiredData`
  accepts `error.data` directly (codes -32042/-32043) or
  `result._meta["org.paymentauth/payment-required"]`, and nothing in between.

**The credential comes back in the body, not a header.** An MCP client's
`setCredential` rewrites `params._meta["org.paymentauth/credential"]` and sets no
header at all, while mppx reads credentials with `Credential.fromRequest`, which
inspects headers only. Without `bridgeMcpCredential` re-attaching it, an MCP
payment settles on-chain and is then refused as unpaid. A credential that
arrives and still does not verify answers **-32043**, never -32042: the agent has
already paid, and "payment required" would charge it twice.

`mppx validate` does not cover any of this — it exercises the HTTP surface,
which is why the bug shipped green. Verify the MCP path by feeding a real
response to mppx's own `paymentRequiredData`.
