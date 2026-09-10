# Smoke test: registration-free agent access

Replaces the earlier email-verification smoke test. Everything below runs
against **production** at `https://fundmomentum.vc` unless stated otherwise.

## Before you start

- **No email is involved anywhere.** If any step asks for one, something is wrong.
- **Registration is capped at 3 new keys per IP per UTC day.** Steps 6 and 7
  spend that budget deliberately, so run them last. From one machine you get
  three keys and a fourth refusal.
- Paying steps need the [Tempo CLI](https://tempo.xyz/developers/docs/cli) and a
  funded wallet. Against a **sandbox** deployment this is testnet play money;
  against production it is **real funds**, so check which you are pointed at
  first with `/_api/debug/mpp-config-check`.
- Report a PASS/FAIL table with the values you actually saw. Do not fix anything;
  report.

## 1 — Keyless still works (0 of 3)

```bash
curl -s https://fundmomentum.vc/_api/mcp -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_funds","arguments":{"stage":"seed","country":"Germany","limit":10}},"id":1}'
```

Expect `200`, real funds, `_meta.auth: "keyless_trial"`, `calls_limit: 10`.
**Expect at most 10 rows even though more exist** — unpaid callers are capped at 10.
FAIL if a key is now required, or if more than 10 rows come back.

## 2 — Register with no email (1 of 3)

```bash
curl -s -X POST https://fundmomentum.vc/_api/agent/register \
  -H "Content-Type: application/json" -d '{"agent_name":"smoke-test-1"}'
```

Expect `201` and:
`api_key` starting `fm_agent_`, `agent_id` starting `agt_`, `agent_credits: 25`,
`tools_on_credits` listing all three free tools, `tools_paid_per_call` with the
three Pro prices, a `payment` block naming `mpp` and `tempo_usdc`.

FAIL if the response contains `email_verified`, `locked_until_email_verified`, or
any mention of verification. FAIL if an email arrives. Save the key.

## 3 — Credits work on ALL six tools

Call `search_funds` (free) then `get_fund_signals` (Pro) with the key.

Expect both `200`. `_meta` shows `billing: "credits"` and `credits_remaining`
dropping **25 → 24** (free tool, 1 credit) then **24 → 14** (Pro tool, 10
credits). FAIL if the Pro tool returns `403 email_verification_required` — that
gate is gone.

## 4 — A failed call is refunded

Call `get_fund_signals` with `{"slug":"definitely-not-a-real-fund-xyz"}`.

Expect an error, and `credits_remaining` **unchanged**. Credits are debited
before the tool runs so concurrent calls cannot overdraw; the failure path gives
them back. FAIL if the balance drops.

## 5 — Paying with no account at all

Use a **fresh terminal with no API key**:

```bash
tempo request -X POST --json '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_fund_signals","arguments":{"slug":"<a real slug from step 1>"}},"id":1}' https://fundmomentum.vc/_api/mcp
```

The first attempt returns `402`; the CLI pays and retries. Expect real signal
data and `_meta.auth: "mpp_inline"` with a `receipt`.

The challenge arrives on a standard `WWW-Authenticate: Payment ...` header and the
paid response carries `Payment-Receipt`. FAIL if either is missing.

A quicker equivalent of this whole step:

```bash
npx mppx@latest validate https://fundmomentum.vc
```

It provisions a throwaway testnet wallet, funds it from a faucet, pays, and
checks the receipt. Expect `25 passed`.

## 6 — Top-up (2 of 3)

Register `smoke-test-2`, then:

```bash
curl -s -X POST https://fundmomentum.vc/_api/agent/credits/topup \
  -H "X-API-Key: <key>" -H "Content-Type: application/json" -d '{"amount_eur":20}'
```

Expect `402` with `amount_eur: 20`, an `amount_usd` slightly **above** a spot
conversion (1.5% buffer), and `credits_on_settlement: 2000`. Pay it and retry;
expect `status: "credited"`, `credits_added: 2000`, and a `receipt`.

Then **present the same credential a second time**. Expect `409
receipt_already_used` and the balance unchanged. FAIL if credits are granted
twice.

Also check `{"amount_eur":7}` returns `400` listing the allowed amounts.

## 7 — Registration cap (3 of 3, then a refusal)

Register `smoke-test-3`, then attempt a fourth.

Expect `429` with `error: "registration_rate_limited"`, `resets_at`, a
`fallback` block naming the keyless tools, and a `payment` block — a refused
agent must never be left without a route. FAIL if the fourth succeeds.

## 8 — Linking is optional and grants nothing

```bash
curl -s -X POST https://fundmomentum.vc/_api/agent/link \
  -H "X-API-Key: <key from step 2>" -H "Content-Type: application/json" \
  -d '{"email":"<an address you control>"}'
```

Expect `202 verification_sent` (or `200 linked` with `email_sent: false` if the
address is already verified, e.g. a Google sign-in). Either way
`credits_remaining` must be **unchanged** and no tool may become newly
available. This is the only step in the whole test that may send email.

`GET /_api/agent/me` should then show `link_pending: true` (or
`linked_account: true` if it linked immediately).

## 9 — Self-inspection is free

`GET /_api/agent/me` with a key. Expect `200`, correct `credits_remaining`,
`spend_today_eur`, `calls_remaining_today`, `trusted`. **The balance must not
change** — this endpoint is never billed.

## 10 — Discovery card

`GET /_api/well-known/mcp/server-card`. Expect `version: "1.3.0"`,
`registration_required: false`, `email_required: false`,
`autonomous_payment_available: true`, six tools each with `access` and
`price_eur`, and **no** `free_tier`, `how_to_get_a_key` or `agent_tier` blocks.

## Not covered here

- **Enumeration limits** (200 slow-mode / 500 refusal distinct funds per day)
  need hundreds of calls; exercise them by seeding `agent_slug_views` directly.
- **Global spend cap** needs `MPP_DAILY_LIMIT_EUR_GLOBAL` lowered in a test
  environment.
- **Tracer records** are deliberately undocumented in public. See the internal
  note; do not name them in a bug report that might be shared.
