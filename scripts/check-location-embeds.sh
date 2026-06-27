#!/usr/bin/env bash
#
# Guard against ambiguous `locations(...)` PostgREST/Supabase embeds.
#
# WHY: the `listings` table has TWO foreign keys to `locations`:
#   - location_id       (listings_location_id_fkey)      — where an item was found
#   - desk_location_id  (listings_desk_location_id_fkey) — the proctor desk
# Because both exist, a bare embed like `.select("*, locations(...)")` is
# ambiguous and the database rejects the request with:
#   "Could not embed because more than one relationship was found
#    for 'listings' and 'locations'"
#
# Every embed must name the relationship, e.g. `locations!location_id(...)`.
# This script fails (exit 1) if any bare `locations(` is found in app source,
# so the mistake is caught before it ships instead of in production.
#
# Run locally:  bash scripts/check-location-embeds.sh
# Runs in CI:   .github/workflows/embed-guard.yml

set -euo pipefail

# Run from the repo root regardless of where the script is invoked.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# A correct embed is `locations!<fk>(...)`, which never contains the substring
# `locations(`. So any literal `locations(` in app code is an un-disambiguated
# (ambiguous) embed. Skip dependencies, build output, and SQL/docs.
matches="$(grep -rnE 'locations\(' \
  --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build \
  my-app 2>/dev/null || true)"

if [ -n "$matches" ]; then
  echo "✖ Ambiguous 'locations(...)' embed(s) found — use 'locations!location_id(...)':"
  echo ""
  echo "$matches"
  echo ""
  echo "See scripts/check-location-embeds.sh for why this fails."
  exit 1
fi

echo "✓ No ambiguous locations(...) embeds found."
