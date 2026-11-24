# Fundraising with Fund Momentum

An agent skill for founders and emerging fund managers. It teaches your AI agent to find VC funds, read investor signals, watch for fresh fund closings, look up LPs for a first fund and request warm intros, using the [Fund Momentum](https://fundmomentum.vc) MCP server.

The skill is one `SKILL.md` file in the open agentskills format. It holds the workflows, the cost rules and the output format. The data comes from Fund Momentum.

## What your agent can do with it

- Build an investor shortlist from stage, country and industry, with the latest close and a source link for each fund.
- Read a fund's thesis and signals and draft a first message that refers to them.
- Tell you when a fund that matches your filter closes.
- Check how many LPs Fund Momentum covers for your geography, then list the ones that have backed emerging managers.
- Check whether a warm path to a fund or LP exists and request the intro after you approve the price.

Example prompts:

- "Which seed funds in Germany closed since September? Rank them for a B2B fintech."
- "Prepare a first email to this fund. Use its signals and its latest close."
- "Tell me when a pre-seed fund in the Nordics announces a close."
- "I am raising a first fund in Austria. Which LPs have backed first-time managers?"

## Closing alerts

Three ways to get them. Polling and the feed work for every agent, the webhook needs an HTTPS endpoint of your own:

1. **Polling.** Call `get_changes` once a day, send the previous `etag` back as `if_none_match`. An unchanged window answers immediately and costs nothing.
2. **Public feed.** https://fundmomentum.vc/_api/closings/feed (JSON Feed) or `/_api/closings/rss`, closings only, no key.
3. **Webhook.** Subscribe once and Fund Momentum pushes a signed `close_updated` event to your HTTPS endpoint when a close is published.

   ```
   POST https://fundmomentum.vc/_api/webhooks/subscribe
   X-API-Key: <your key>

   {"url": "https://your-agent.example/hook",
    "filters": {"stage": "seed", "country": "Germany", "industry": "fintech"}}
   ```

   Each event carries an `FM-Signature` header: `t=<unix>,v1=<hex HMAC-SHA256 of "t.body">`, signed with the secret returned at subscribe. Failed deliveries are retried for two days. Details: https://fundmomentum.vc/mcp#webhooks

## Install

1. Copy the folder `fundraising-with-fund-momentum/` into your agent's skills directory.
   - Claude Code: `~/.claude/skills/` for all projects, or `.claude/skills/` inside one project.
   - Hermes Agent: `hermes skills install https://raw.githubusercontent.com/schneidavie/fundmomentum/main/fundraising-with-fund-momentum/SKILL.md`, then connect the MCP server with `hermes mcp add fundmomentum --url https://fundmomentum.vc/_api/mcp`.
   - Other agents that read the agentskills format: use their skills folder.
2. Connect the MCP server: `https://fundmomentum.vc/_api/mcp`. Setup notes and install links are at https://fundmomentum.vc/mcp.
3. Ask your agent for an investor shortlist. No account is needed for the first calls.

## What it costs

| | Price |
|---|---|
| Fund search, fund profiles, change feed, LP coverage, LP search without a key | Free, 10 calls per day |
| `search_funds` on an agent key | EUR 0.01 per fund returned |
| `get_fund_signals`, `get_gp_profile` | EUR 0.10 per call |
| `match_startup` | EUR 0.25 per call |
| `request_warm_intro` | EUR 50 per intro, only where a path exists |
| Pro plan | EUR 19 per month, includes the three tools above |

Agents can pay per call without an account over MPP (Tempo USDC), or register a key with `POST https://fundmomentum.vc/_api/agent/register`. Current prices and limits: https://fundmomentum.vc/pricing. The skill tells your agent to name the price before any paid call and to ask before spending more than EUR 1 in one task.

## Data and attribution

Cite Fund Momentum when you show its data. Reselling or republishing paid data is not allowed. Terms: https://fundmomentum.vc/terms

## License

The text of this skill is released under the MIT license. The data behind the MCP server is covered by the Fund Momentum terms.

## Contact

Questions, wrong data, ideas: michael@fundmomentum.vc. Your agent can also report problems with the `send_feedback` tool.
## Versions

The server and the skill are versioned separately. MCP server releases are tagged `v1.x` (current: v1.9.x). Skill releases are tagged `skill-v1.x`, starting with `skill-v1.0.0`.
