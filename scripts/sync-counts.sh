#!/usr/bin/env bash
#
# Sync the live numbers from the Fund Momentum MCP server card into the docs.
#
# Why this exists: the fund count in this repo was hand-edited and drifted
# every time the database grew. v1.0.1 hand-aligned README.md and server.json
# and they were wrong again within seven weeks. Nothing below is hardcoded --
# every number is read from the live server card at build time.
#
# Usage:
#   scripts/sync-counts.sh           rewrite the docs in place
#   scripts/sync-counts.sh --check   exit 1 if the docs are stale (CI gate)
#
# To change the *wording* around a number, edit the marker text in README.md
# or the DESCRIPTION_TEMPLATE below. To sync a number in a new spot, wrap it
# in a marker pair -- <!--fm:funds-->1000+<!--/fm:funds--> -- and it is picked
# up automatically. HTML comment markers are invisible in rendered Markdown.
#
# The fund count is published rounded down ("1000+"), matching the site's own
# marketing copy and the server card's note that it rounds the live figure
# down. It is still derived from the card on every run, never typed by hand.

set -euo pipefail

CARD_URL="${FM_SERVER_CARD_URL:-https://fundmomentum.vc/_api/well-known/mcp/server-card}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECK=0
[ "${1:-}" = "--check" ] && CHECK=1

command -v jq >/dev/null 2>&1 || {
  echo "sync-counts: jq is required (preinstalled on ubuntu-latest; locally: apt install jq / brew install jq)" >&2
  exit 2
}

card="$(curl -fsSL --max-time 30 -H 'Accept: application/json' "$CARD_URL")" || {
  echo "sync-counts: could not fetch $CARD_URL" >&2
  exit 2
}

FUNDS="$(printf '%s' "$card"        | jq -er '.counts.funds')"
LPS="$(printf '%s' "$card"          | jq -er '.counts.limited_partners')"
VERSION="$(printf '%s' "$card"      | jq -er '.serverInfo.version')"
KEYLESS="$(printf '%s' "$card"      | jq -er '.authentication.keyless_trial.calls_per_caller_per_utc_day')"
FREE_CALLS="$(printf '%s' "$card"   | jq -er '.authentication.free_tier.calls_per_month')"
PRO_PRICE="$(printf '%s' "$card"    | jq -er '[.tools[] | select(.requiredTier == "pro") | .price] | unique | .[0]')"

# Never let a broken or empty response blank out the docs.
case "$FUNDS$LPS$KEYLESS$FREE_CALLS" in *[!0-9]*) echo "sync-counts: non-numeric count in card" >&2; exit 2;; esac
[ "$FUNDS" -gt 0 ] && [ "$LPS" -gt 0 ] || { echo "sync-counts: implausible counts (funds=$FUNDS lps=$LPS)" >&2; exit 2; }
[ -n "$PRO_PRICE" ] && [ "$PRO_PRICE" != "null" ] || { echo "sync-counts: no pro price in card" >&2; exit 2; }

# 1045 -> 1,045
group() { printf '%s' "$1" | sed -E ':a;s/([0-9])([0-9]{3})($|,)/\1,\2\3/;ta'; }

# 1045 -> 1000+  (round down to the nearest hundred, no thousands separator).
# Publishing the exact live figure would be a claim that goes stale between
# runs; rounding down is always true and still moves on its own as we grow.
round_down() {
  if [ "$1" -lt 100 ]; then printf '%s' "$1"; else printf '%s+' "$(( $1 / 100 * 100 ))"; fi
}

FUNDS_H="$(round_down "$FUNDS")"
LPS_H="$(group "$LPS")"
FREE_CALLS_H="$(group "$FREE_CALLS")"

# server.json has no room for HTML markers, so its description is rendered
# from this template. This is the one place to edit that sentence.
DESCRIPTION_TEMPLATE="__FUNDS__ actively deploying VC funds and __LPS__ disclosed LPs, with live investor signals"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
stale=0

# --- Markdown: substitute between <!--fm:key--> ... <!--/fm:key--> pairs ---
render_markdown() {
  sed -E \
    -e "s|(<!--fm:funds-->)[^<]*(<!--/fm:funds-->)|\1${FUNDS_H}\2|g" \
    -e "s|(<!--fm:lps-->)[^<]*(<!--/fm:lps-->)|\1${LPS_H}\2|g" \
    -e "s|(<!--fm:keyless_calls-->)[^<]*(<!--/fm:keyless_calls-->)|\1${KEYLESS}\2|g" \
    -e "s|(<!--fm:free_calls-->)[^<]*(<!--/fm:free_calls-->)|\1${FREE_CALLS_H}\2|g" \
    -e "s|(<!--fm:pro_price-->)[^<]*(<!--/fm:pro_price-->)|\1${PRO_PRICE}\2|g" \
    -e "s|(<!--fm:version-->)[^<]*(<!--/fm:version-->)|\1${VERSION}\2|g" \
    "$1"
}

# --- server.json: version + rendered description ---
render_server_json() {
  local desc="${DESCRIPTION_TEMPLATE//__FUNDS__/$FUNDS_H}"
  desc="${desc//__LPS__/$LPS_H}"
  jq --arg v "$VERSION" --arg d "$desc" '.version = $v | .description = $d' "$1"
}

# The repo is LF (see .gitattributes), but jq and sed emit CRLF when this runs
# on Windows. Normalise what we render, and compare ignoring CR so a CRLF
# checkout is not reported as drift on every single line.
strip_cr() { tr -d '\r' < "$1" > "$1.lf" && mv "$1.lf" "$1"; }
same_apart_from_cr() { diff -q <(tr -d '\r' < "$1") <(tr -d '\r' < "$2") >/dev/null 2>&1; }

sync_file() {
  local rel="$1" renderer="$2"
  local src="$ROOT/$rel" out="$tmp/$(echo "$rel" | tr '/' '_')"
  [ -f "$src" ] || return 0
  "$renderer" "$src" > "$out"
  strip_cr "$out"
  if same_apart_from_cr "$src" "$out"; then
    echo "  ok    $rel"
  elif [ "$CHECK" = "1" ]; then
    echo "  STALE $rel"
    diff -u <(tr -d '\r' < "$src") <(tr -d '\r' < "$out") | sed 's/^/        /' || true
    stale=1
  else
    cp "$out" "$src"
    echo "  wrote $rel"
  fi
}

echo "sync-counts: card reports funds=$FUNDS_H lps=$LPS_H version=$VERSION keyless=$KEYLESS/day free=$FREE_CALLS_H/mo pro=$PRO_PRICE"
sync_file "README.md"             render_markdown
sync_file "examples/founders.md"  render_markdown
sync_file "examples/developers.md" render_markdown
sync_file "server.json"           render_server_json

if [ "$stale" = "1" ]; then
  echo "sync-counts: docs are stale. Run scripts/sync-counts.sh and commit the result." >&2
  exit 1
fi
