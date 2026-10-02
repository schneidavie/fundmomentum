# Changelog

All notable changes to the Fund Momentum MCP server.

## [1.5.0] — 2026-10-02

Closing the gap for people who hit a refusal in a chat client, and fewer wasted
calls on near-miss fund names.

### Added

- **Fund name resolution** in `get_fund`, `get_fund_signals` and
  `get_gp_profile`. When the exact slug misses and exactly one fund is a close
  match (case or spacing differences, or a hyphen-boundary prefix of one real
  slug), it is served and the result carries `resolved_from` naming what was
  requested. Several matches are listed and none is picked; no match is
  `not_found`. Resolution happens before any payment challenge, so a wrong name
  is never charged. Deliberately not fuzzy.

### Changed

- Refusal messages (`missing_key`, `anon_quota_exceeded`,
  `anon_ip_ceiling_exceeded`, `insufficient_tier`, payment required,
  `lp_access_required`) now open with the route for a person (a free key at
  fundmomentum.vc/pricing) and give the agent route second. Everything in
  `error.data` / `_meta` is unchanged, as are the facts each message carried
  (what was not charged, coverage counts, the keyless fallback).

## [1.4.1] — 2026-09-28

Documentation only; the server is unchanged. Tags the docs fixes listed under
1.4.0 → Fixed, which landed after the 1.4.0 tag: the keyless trial covers four
tools, "six fund tools" wherever credits or MPP apply, the eight-tool reference
and the LP example in `examples/developers.md`. The v1.3.0 changelog entry is
trimmed of anti-scraping internals, and the internal ops runbooks have moved
out of this repo.

## [1.4.0] — 2026-09-27

LP data over MCP, and LP Radar you can actually buy.

### Added

- **`check_lp_coverage`** — free and keyless. How many limited partners match a
  country and LP type, as counts only; never a name, website or commitment.
  Counts under 5 show as `"<5"`, zero as `"none"`. Costs no credit.
- **`search_lps`** — LP records (name, type, HQ, geographic focus, website,
  emerging-manager backing), max 25 per call, unlimited calls, on the key of an
  account holding **LP Radar** (€199/month or €1,499/year). Not sold per call,
  on agent credits, over MPP or on the keyless trial; without LP Radar it answers
  HTTP `403` / JSON-RPC `-32001` with `error_reason: "lp_access_required"`, the
  coverage count and the purchase link — no payment challenge, nothing charged.
- **Self-serve LP Radar checkout.** Card payment via Stripe on
  [fundmomentum.vc/lp-radar](https://fundmomentum.vc/lp-radar). Access and an
  API key switch on right after payment; no account needed beforehand. Replaces
  the request-and-invoice flow.

### Changed

- Tool count 6 → 8. The per-call ladder, credits and MPP cover the six fund
  tools only; the two LP tools sit outside it.
- `server.json`: 608 disclosed LPs, version 1.4.0.
- Published fund count 1000+ → 1100+ (1,106 live), synced from the server card.

### Fixed

- `scripts/sync-counts.sh` read `counts.limited_partners`, which the 1.4.0
  server card renamed to `counts.disclosed_lps`, so it failed under `jq -e`
  before rendering anything — including in the weekly sync and pre-publish
  workflows. It now reads `disclosed_lps` and falls back to the old key.
- **Docs: keyless trial.** The README said the keyless trial covered
  `search_funds` and `get_fund` only, and that `get_changes` needed a key. It
  covers four tools: `search_funds`, `get_fund`, `get_changes` (at most 7 days
  back; a free key widens that to 30) and `check_lp_coverage`, sharing 10 calls
  per caller per UTC day.
- **Docs: six fund tools.** Credits and MPP rows now say "six fund tools"
  throughout, and the developer tool reference lists all eight tools.
- **Docs: LP example.** `examples/developers.md` gains a Python example for
  `check_lp_coverage` and for handling the `lp_access_required` refusal of
  `search_lps`.

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
- Existing agent keys keep authenticating with their previous balance.

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

### Validation

`npx mppx@latest validate https://fundmomentum.vc` — **25 passed**, including a
real on-chain payment from an ephemeral wallet and a verified `Payment-Receipt`.
Discovery is served from `static/openapi.json` at `/openapi.json`.

Three things had to be right, each of which failed silently at first:

- The app must return **`200`** with `x-floot-status: 402` and
  `x-floot-www-authenticate`; the CDN assembles the real 402 with a standard
  `WWW-Authenticate`. Returning a real 402 from the app means AWS renames the
  header and stock wallets never see the challenge.
- `mppx.charge()` must be called **without** `currency` on an EVM rail — mppx
  resolves the Tempo USDC token address itself, and `currency: "usd"` (correct
  in Stripe's SPT sample) makes every wallet fail with `Address "usd" is invalid`.
- A **failed** paid call must still return its `Payment-Receipt`. Inline payments
  settle on-chain and are not auto-refunded, so withholding the receipt left the
  payer charged with no proof.

## [1.2.0] — 2026-09-06

Tiered agent credit grant with email-gated Pro tools, registration rate limiting,
HTTP 402 out-of-credits. **Superseded by 1.3.0**, which removes the email gate.

## [1.1.1] — 2026-08-30

Documentation: LP count sync, keyless trial moved to the top of the README,
pricing aligned with the live site.

## [1.1.0] — 2026-08-25

`get_changes` incremental sync, tool titles and annotations, counts generated
from the live server card.
