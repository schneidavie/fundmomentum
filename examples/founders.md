# Example Prompts for Founders

Use these prompts in Claude Desktop after connecting Fund Momentum.

You do not need an API key to start. `search_funds` and `get_fund` — which cover
everything in Investor Research below — answer <!--fm:keyless_calls-->10<!--/fm:keyless_calls-->
calls per day with no credential at all. A free key at
[fundmomentum.vc/mcp](https://fundmomentum.vc/mcp) raises that to
<!--fm:free_calls-->100<!--/fm:free_calls--> calls/month.

## Investor Research

```
Which seed funds in Austria invest in B2B SaaS?
```

```
Show me 10 active pre-seed funds in the UK focused on deep tech
```

```
Which European funds invest in AI-native fintech at seed stage?
```

## GP Intelligence

```
What is Speedinvest bullish on right now?
```

```
What should I know before pitching Point Nine Capital?
```

```
What are the founder dos and don'ts for pitching Accel?
```

## Startup Matching

```
Match my startup to investors:
- B2B SaaS for legal teams
- €400K ARR, 115% NRR
- Raising €3M seed
- Vienna-based, targeting DACH

Give me the top 10 matches with reasoning.
```

```
I'm building an AI-native payroll tool for SMEs in Germany.
Pre-seed, raising €750K. Which funds should I approach?
```

## Staying Current

Rather than re-running the same search every week, ask for what actually moved.
Claude will use `get_changes` for these.

```
What changed in the Fund Momentum database since last Monday?
```

```
Any new or updated seed funds in the DACH region in the last 14 days?
Skip anything I would have seen a month ago.
```

## Outreach Prep

```
I'm pitching [FUND NAME] next week.
Give me their latest thesis tags, what they're bullish on,
and the top 3 things I should emphasize in my pitch.
```

```
Compare Speedinvest and Point Nine for a B2B SaaS seed round.
Which one fits better and why?
```
