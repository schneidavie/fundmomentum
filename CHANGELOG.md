# Changelog

All notable changes to the Fund Momentum MCP server.

## [1.3.0] — 2026-09-09

Registration-free agent access and autonomous pay-per-call.

### Added

- **Registration-free access.** An agent can discover the server, pay for what it
  needs and get data with no human, no account and no email at any point.
  Identity is the API key, or for inline payments the paying wallet.
- **Machine payments (MPP) over Tempo USDC.** A Pro tool called with **no key at
  all** answers HTTP `402` with a payable challenge; pay and retry to get the
  data plus a receipt. `POST /_api/agent/credits/topup` buys a balance the same
  way (€5 / €20 / €50 / €100).
- **Anonymous keys.** `POST /_api/agent/register` now takes `{"agent_name":"..."}`
  and nothing else. Optional `operator_url` and `contact` are free text and never
  verified. 25 free credits (€0.01 each) on creation, usable on all six tools.
- `GET /_api/agent/me` — balance, spend, limits and trust standing. Free, never
  billed, so an agent never has to spend a credit to learn it is nearly out.
- `POST /_api/agent/link` and `/link/resend` — optional email linking for
  invoices and a dashboard. Grants no access, changes no credits. These are the
  only endpoints in the agent path that ever send email.
- **Spend caps.** €100 per payer per UTC day and a global daily ceiling, both
  checked *before* a challenge is issued — never invite a payment that would then
  be refused.
- **Enumeration detection.** Tracks distinct funds retrieved per caller per day:
  slow-mode above 200, refusal above 500. Paid callers are exempt.
- **Tracer records.** Three fictitious funds, mixed into free results only, to
  detect scraping. Never shown to a paying caller.
- **Response shaping.** Unpaid callers get 10 `search_funds` rows (50 when paid),
  20 `get_changes` items and a 30-day lookback floor. A shortened window is
  declared as `since_floor_applied` rather than silently truncated.

### Changed

- **Server card 1.3.0.** `registration_required: false`, `email_required: false`,
  `autonomous_payment_available: true`. The overlapping `free_tier` /
  `how_to_get_a_key` / `agent_tier` blocks are replaced by one authoritative set.
  Every tool now carries `access` and `price_eur`.
- Out-of-credits is HTTP `402`, not JSON-RPC `-32001`. **Update handlers matching
  the old code.**
- Stripe SDK 16.12.0 → 17.7.0 (required for `rawRequest()`). The API *version*
  stays pinned at `2024-06-20`: the 2025 versions move `current_period_end` off
  the Subscription object, which live subscription code reads.
- Human Free / Starter / Pro subscriptions are unchanged and unaffected.

### Removed

- **Email verification no longer gates anything.** Most agents cannot read email,
  so it placed a human step inside a flow promising "register and call in the
  same second", and it was never the real abuse control. Pricing is.

### Fixed

- **Human/agent collision.** `/_api/agent/register` shared the `users` table with
  the Google sign-up, so a person who had signed in with Google and then called
  it received `status: "existing"`, a **null** `api_key`, zero credits, and a
  response listing all six tools as usable. Agents now live in their own table
  and the endpoint never touches `users`.
- A payment-stack load failure took down the entire MCP server, including keyless
  calls that never touch payments. Payments now load on demand.
- `viem`, a peer dependency of the MPP rail, was pruned from the deploy.

### Known issues

- AWS API Gateway renames `WWW-Authenticate` to `x-amzn-remapped-www-authenticate`.
  The identical challenge is repeated on `X-Payment-Challenge` and as
  `www_authenticate` in the body. Prefer the standard header; fall back to those.
- `get_fund` on a tracer slug returns not-found, so following a tracer's profile
  URL distinguishes it from a real record.

### Migration

Additive only; nothing was deleted and `users` was not modified. New tables:
`agents`, `agent_payments`, `agent_usage_daily`, `agent_slug_views`, `fx_rates`,
`mpp_store`, `tracer_funds`. Existing agent keys were copied into `agents` and
continue to authenticate with their previous balance.

## [1.2.0] — 2026-09-06

Tiered agent credit grant with email-gated Pro tools, registration rate limiting,
HTTP 402 out-of-credits. **Superseded by 1.3.0**, which removes the email gate.

## [1.1.1] — 2026-08-30

Documentation: LP count sync, keyless trial moved to the top of the README,
pricing aligned with the live site.

## [1.1.0] — 2026-08-25

`get_changes` incremental sync, tool titles and annotations, counts generated
from the live server card.
