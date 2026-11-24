---
name: fundraising-with-fund-momentum
description: Use when a founder or an emerging fund manager needs investors, VC funds, LPs or fresh fund closings. Finds funds by stage, country and industry, reads GP signals before outreach, watches for new closings, checks LP coverage for first-time funds and requests warm intros, all through Fund Momentum (fundmomentum.vc). Triggers include "which VCs invest in X", "build me an investor list", "who just closed a fund", "prepare outreach to this fund", "find LPs for my first fund", "tell me when a seed fund in Germany closes".
license: MIT
compatibility: Needs the Fund Momentum MCP server (docs at https://fundmomentum.vc/mcp) or its REST API, plus network access. Works without an account for basic searches.
metadata:
  author: Fund Momentum
  version: "1.0.0"
---

# Fundraising with Fund Momentum

Fund Momentum tracks actively deploying VC funds, their latest closes, investor signals and a set of LPs. This skill tells you when to call which tool, what it costs and how to present the result. Use it for fundraising work only: investor lists, outreach prep, closing alerts, LP search, warm intros.

## Setup

1. Connect the Fund Momentum MCP server. Docs and install links: https://fundmomentum.vc/mcp
2. No key is needed to start. Keyless calls cover search_funds, get_fund, get_changes, check_lp_coverage and search_lps, limited to 10 calls per day.
3. For more, register an agent key: POST https://fundmomentum.vc/_api/agent/register with {"agent_name": "<your name>"} and send the key as the X-API-Key header.
4. A paid tool called without a key or credits answers with HTTP 402 and a payment challenge (MPP, paid in Tempo USDC). Only pay if the user has approved the spend (see Cost rules).

## Tools and what they cost

| Tool | Use it for | Cost on an agent key |
|---|---|---|
| search_funds | Find funds by stage, country, industry, closed_since | 1 credit (EUR 0.01) per fund returned |
| get_fund | Full profile of one fund, last close with source URL, provenance | 1 credit per call |
| get_changes | Funds whose data changed since a timestamp | 1 credit per poll with changes, empty polls free |
| get_fund_signals | GP thesis, bullish and contrarian signals, founder dos and don'ts | EUR 0.10 |
| get_gp_profile | GP profiles for one fund | EUR 0.10 |
| match_startup | Rank funds from a plain-language startup description (3 to 10 seconds) | EUR 0.25 |
| check_lp_coverage | Counts of LPs by country and type, no names | Free |
| search_lps | LP records, up to 25 per call | 1 credit (EUR 0.01) per LP row |
| request_warm_intro | Ask the founder of Fund Momentum for an intro | EUR 50 flat, see Warm intros |
| get_usage | Remaining calls and credits | Free |

Pro subscribers get signals, GP profiles and match_startup included. Check the tool descriptions for current prices, they win over this table.

## Cost rules

- Start with free calls. Never use a paid tool when a keyless one answers the question.
- Tell the user the price before a paid call. For several calls, give the total first.
- Ask for approval before spending more than EUR 1 in one task, and always before request_warm_intro.
- Keep searches narrow. The default limit is 10. Set max_credits when you can.
- Copy slugs from search results. Never build a slug from a fund name.

## Recipes

### 1. Investor shortlist for a startup

1. Confirm three facts with the user: stage, HQ country or region, industry. Ask nothing else first.
2. Call search_funds with those filters. If the brief is qualitative ("climate hardware, pre-seed, Europe"), call match_startup instead.
3. Take the 5 to 10 best funds. Call get_fund for each. Offer get_fund_signals for the top 3 to 5 and state the cost.
4. Return a table: fund, stage, size, last close (type and date), why it fits, signal note, warm path yes or no.

### 2. Outreach prep for one fund

1. get_fund, get_fund_signals and get_gp_profile for that slug.
2. Draft a first message that names one thing from the fund's own thesis and its latest close. One ask. No flattery, no pitch deck dump.
3. Mark every claim in the draft with its source and tell the user to check the facts before sending. Do not send anything yourself unless the user asks.

### 3. Watch for new closings

Pick the route that fits the agent:

- **Polling (works everywhere):** follow the steps below.
- **Public feed (no key):** https://fundmomentum.vc/_api/closings/feed (JSON Feed) or /_api/closings/rss, with ?since=YYYY-MM-DD. Closings only, with source links.
- **Webhook (for agents that can receive HTTPS calls):** POST https://fundmomentum.vc/_api/webhooks/subscribe with your key and {"url": "https://...", "filters": {"stage": "seed", "country": "Germany", "industry": "fintech"}}. Fund Momentum then pushes a signed close_updated event when a close is published. Verify the FM-Signature header before trusting an event. If no event arrives after the first matching close, fall back to polling. Limits depend on the plan, see https://fundmomentum.vc/mcp#webhooks.

Polling steps:

1. Call get_changes. Store next_since and etag from the response. Ask the user where to keep them if you have no memory.
2. Poll at most once per day. Send if_none_match with the stored etag. If the answer is unchanged: true, do nothing and say nothing.
3. Keep rows with change_type close_updated. Check each against the user's stage, industry and country (get_fund if the row lacks them).
4. Notify only on matches. One message per fund: name, size, close type and date, source URL, why it matches, suggested next step.
5. Without a key the window reaches back 7 days. A free key reaches back 30 days.

### 4. LPs for a first or second fund

1. check_lp_coverage with the user's country and LP type. It is free and returns counts only. Tell the user what the dataset covers before spending anything.
2. search_lps with backs_emerging_managers set to true, plus country and lp_type. Use a small limit first.
3. Present results as a short list: LP, type, HQ, focus, warm path yes or no.

### 5. Warm intros

1. get_fund and search_lps show michael_network.has_warm_path. If it is true, tell the user that a path may exist in the personal network of Fund Momentum's founder.
2. Say plainly: an intro costs EUR 50 flat, no subscription makes it free, and it is paid only after a path is confirmed. Fulfilment is manual with no guaranteed timeline.
3. After the user says yes, call request_warm_intro with target_type, slug, an optional contact name and a short context note (what is being raised, timing). Show the note to the user first.
4. If there is no known path, the call creates a free path check instead. Nothing is charged until a path is found and the account holder approves.
5. An agent key must be linked to a human account before this tool works. Link it with POST https://fundmomentum.vc/_api/agent/link, otherwise the call is refused.

## Presenting results

- Use tables for lists of funds or LPs. Add a one-line verdict above the table.
- Fields marked unverified are not confirmed. Say so.
- Show the source URL of the last close when you mention a close.
- Attribute the data: "Source: Fund Momentum (fundmomentum.vc)". Citing with attribution is allowed. Reselling or republishing paid and LP Radar data is not.
- Never invent funds, fund sizes, close dates, LPs or contacts. If a search returns nothing, say so and suggest wider filters.

## Limits

- Coverage is VC funds. Private equity and credit funds are out of scope.
- Closes come from Fund Momentum's own coverage with a delay. A very recent close may be missing.
- Warm paths exist only for some funds and LPs.
- This is research support, not investment or legal advice.
- If a result looks wrong, report it with the send_feedback tool.
