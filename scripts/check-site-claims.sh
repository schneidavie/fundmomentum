#!/usr/bin/env bash
#
# Compare the rounded "N+" claims on the live site against the live counts.
#
# Two different LP numbers exist and they are not interchangeable:
#   directory LPs  = the public /lp-database list    (filter-options .total)
#   LP Radar LPs   = what search_lps can return      (server card disclosed_lps)
# The site copy ("600+ LPs", "470+ institutions", "75+ countries") describes the
# public directory, so it is checked against the directory, never against the
# larger LP Radar figure.
#
# A claim "N+" passes when N <= live and live < N + STEP (not stale). A claim
# above the live figure is a false statement and fails hard (exit 1). A claim
# more than one step behind is only a warning.
#
# Usage: scripts/check-site-claims.sh      (read-only, writes nothing)

set -euo pipefail
BASE="${FM_BASE_URL:-https://fundmomentum.vc}"
STEP=50
fail=0

card="$(curl -fsSL --max-time 30 "$BASE/_api/well-known/mcp/server-card")"
opts="$(curl -fsSL --max-time 30 "$BASE/_api/lps/filter-options")"
llms="$(curl -fsSL --max-time 30 "$BASE/llms.txt")"

FUNDS="$(jq -er '.counts.funds' <<<"$card")"
RADAR_LPS="$(jq -er '.counts.disclosed_lps' <<<"$card")"
DIR_LPS="$(jq -er '.json.total' <<<"$opts")"
ANGELS="$(jq -er '[.json.lpTypes[] | select(.name=="Individual / Angel") | .count] | add // 0' <<<"$opts")"
COUNTRIES="$(jq -er '.json.countries | length' <<<"$opts")"
INSTITUTIONS=$(( DIR_LPS - ANGELS ))

echo "live: funds=$FUNDS directory_lps=$DIR_LPS (institutions=$INSTITUTIONS angels=$ANGELS countries=$COUNTRIES) radar_lps=$RADAR_LPS"

# claim <label> <regex capturing N before "+"> <live value> <step>
claim() {
  local label="$1" re="$2" live="$3" step="$4" n
  n="$(grep -oE "$re" <<<"$llms" | grep -oE '^[0-9,]+' | tr -d ',' | sort -n | tail -1 || true)"
  if [ -z "$n" ]; then echo "  skip  $label (no claim found in llms.txt)"; return; fi
  if [ "$n" -gt "$live" ]; then
    echo "  FAIL  $label claims $n+ but live is $live"; fail=1
  elif [ $(( live - n )) -ge $(( step * 2 )) ]; then
    echo "  warn  $label claims $n+, live is $live (more than one step behind)"
  else
    echo "  ok    $label claims $n+, live is $live"
  fi
}

claim "funds"                '[0-9,]+\+ (VC )?funds'               "$FUNDS"        "$STEP"
claim "directory LPs"        '[0-9,]+\+ (limited partners|LPs)'    "$DIR_LPS"      "$STEP"
claim "institutions"         '[0-9]+\+ institutions'               "$INSTITUTIONS" 10
claim "operators and angels" '[0-9]+\+ operators and angels'       "$ANGELS"       10
claim "countries"            '[0-9]+\+ countries'                  "$COUNTRIES"    5

exit "$fail"
