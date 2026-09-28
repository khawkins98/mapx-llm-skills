#!/usr/bin/env bash
# Check that every resolver name used in the skills exists upstream.
#
# Extracts names from `ask("name"` / `askWithTimeout(..."name"` calls in
# skills/ and README.md, and compares them with the resolver methods defined
# in unep-grid/mapx app/src/js/sdk/src/mapx_resolvers/*.js.
#
# Usage:
#   scripts/check-resolvers.sh                 # sparse-clones upstream `main`
#   scripts/check-resolvers.sh <ref>           # e.g. 1.14.0-fix.1 (tag or branch)
#   MAPX_SRC=/path/to/mapx scripts/check-resolvers.sh   # use a local checkout
#
# Exit code 1 if any documented resolver is missing upstream.

set -euo pipefail

REF="${1:-main}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RESOLVER_DIR_REL="app/src/js/sdk/src/mapx_resolvers"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if [[ -n "${MAPX_SRC:-}" ]]; then
  resolver_dir="$MAPX_SRC/$RESOLVER_DIR_REL"
else
  git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$REF" --filter=blob:none --sparse \
    https://github.com/unep-grid/mapx.git "$tmp/mapx"
  git -C "$tmp/mapx" sparse-checkout set "$RESOLVER_DIR_REL"
  resolver_dir="$tmp/mapx/$RESOLVER_DIR_REL"
fi

[[ -d "$resolver_dir" ]] || { echo "Resolver dir not found: $resolver_dir" >&2; exit 2; }

# Upstream: class methods at two-space indent, excluding private (_x) ones.
grep -hoE '^  (async )?[a-z][a-z0-9_]*\(' "$resolver_dir"/*.js \
  | sed -E 's/^  (async )?//; s/\($//' \
  | grep -v '^constructor$' | sort -u > "$tmp/upstream.txt"

# Documented: first string argument of ask()/askWithTimeout() calls.
grep -rhoE '(ask|askWithTimeout)\((mapx, *|sdk, *)?"[a-z][a-z0-9_]*"' \
  "$REPO_ROOT/skills" "$REPO_ROOT/README.md" \
  | grep -oE '"[a-z0-9_]+"' | tr -d '"' \
  | grep -v '^resolver_name$' | sort -u > "$tmp/documented.txt"

missing="$(comm -23 "$tmp/documented.txt" "$tmp/upstream.txt")"
undocumented="$(comm -13 "$tmp/documented.txt" "$tmp/upstream.txt" | tr '\n' ' ')"

echo "Upstream resolvers ($REF): $(wc -l < "$tmp/upstream.txt" | tr -d ' ')"
echo "Documented resolvers:      $(wc -l < "$tmp/documented.txt" | tr -d ' ')"
echo
echo "Upstream but not used in any example (informational):"
echo "  $undocumented"
echo

if [[ -n "$missing" ]]; then
  echo "ERROR: documented resolvers not found upstream:"
  echo "$missing" | sed 's/^/  - /'
  exit 1
fi
echo "OK: every documented resolver exists upstream."
