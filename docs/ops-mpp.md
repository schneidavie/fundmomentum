# Operating machine payments (MPP)

Runbook for the pay-per-call path. Everything here assumes access to the Floot
project and the Stripe dashboard.

## Environment

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY_TEST` | Sandbox key. **Takes precedence when set.** |
| `STRIPE_PROFILE_ID_TEST` | Sandbox Machine Payments profile (`profile_test_…`) |
| `TEMPO_DEPOSIT_ADDRESS_TEST` | Sandbox Tempo address (testnet) |
| `STRIPE_SECRET_KEY` | Live key. Already present; used by existing subscriptions. |
| `STRIPE_PROFILE_ID` | Live profile id (`profile_…`) |
| `TEMPO_DEPOSIT_ADDRESS` | Live Tempo address (**mainnet — real funds**) |
| `MPP_ENABLED` | `false` disables payments entirely |
| `MPP_DAILY_LIMIT_EUR_PER_PAYER` | Default 100 |
| `MPP_DAILY_LIMIT_EUR_GLOBAL` | Default 100. Launch kill switch. |

`livemode` is derived from the key itself (`sk_test_` → testnet), exactly as
Stripe's own sample does, so a test key cannot produce a mainnet challenge.

**The `*_TEST` variables win whenever they are set.** Going live means removing
them, not adding anything.

## Health check

`GET /_api/debug/mpp-config-check` reports, without ever exposing a secret:

- whether the stored key still authenticates (a `401` means it was rolled)
- the profile id Stripe itself reports, and whether it matches what is stored
- whether the Tempo address is owned by that account, and its `livemode`
- a live challenge dry run — **`http_status: 402` is success**

Run it first for any payment problem. It distinguishes "misconfigured" from
"broken" in one request.

## Going live

1. Confirm `mppx validate` passes against the sandbox.
2. Create a **mainnet** deposit address on the live account:
   ```bash
   curl.exe https://api.stripe.com/v1/crypto/deposit_addresses \
     -u "sk_live_YOUR_KEY:" -H "Stripe-Version: 2026-07-29.preview" -d network=tempo
   ```
3. Store it as `TEMPO_DEPOSIT_ADDRESS`, and the live profile id as
   `STRIPE_PROFILE_ID`.
4. **Remove** `STRIPE_SECRET_KEY_TEST`, `STRIPE_PROFILE_ID_TEST` and
   `TEMPO_DEPOSIT_ADDRESS_TEST`.
5. Re-run the health check. `mpp_livemode` must be `true` and
   `deposit_address_livemode` must be `true`.
6. Leave `MPP_DAILY_LIMIT_EUR_GLOBAL` at 100 for the first days. It bounds
   total site-wide exposure while settlement is watched.

## Rotating the Tempo deposit address

Create a new one (step 2 above), update `TEMPO_DEPOSIT_ADDRESS`, verify with the
health check. Existing unpaid challenges reference the **old** address and will
still settle there — do not decommission it until outstanding challenges have
expired (challenge TTL is minutes, not days).

Never create deposit addresses on the request path. It is a one-time setup call.

## Raising the global cap

`MPP_DAILY_LIMIT_EUR_GLOBAL`. When exceeded, challenges stop with `503
payments_paused` and `resets_at`. Raise deliberately, after checking
`agent_payments` for the previous days:

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

## Known platform constraint

AWS API Gateway **renames** `WWW-Authenticate` to
`x-amzn-remapped-www-authenticate` on the way out. The identical challenge value
is therefore also sent on `X-Payment-Challenge` and as `www_authenticate` in the
JSON body, by `helpers/paymentChallengeResponse.tsx`.

This is a hosting behaviour, not something the application can fix, and it may
cause a spec-conformance checker to flag the missing canonical header. If the
platform ever stops rewriting, that workaround can be deleted in one place.

## When payments break

1. `GET /_api/debug/mpp-config-check`.
2. `get_logs` for `[mpp]`, `[billing]`, `[topup]`, `[eurUsdRate]`.
3. If the payment stack fails to load entirely, paid tools answer `503
   payments_unavailable` and **free traffic is unaffected** — payments are
   imported on demand precisely so an outage cannot take down the whole server.
4. `MPP_ENABLED=false` disables payments cleanly if needed.
