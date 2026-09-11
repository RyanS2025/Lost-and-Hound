#!/usr/bin/env bash
#
# Guard: listings.description_internal must never reach a non-staff client.
#
# WHY: the auto-sorter splits a listing description in two. `description` is
# the public, auto-redacted text; `description_internal` is the original, and
# it holds exactly the identifying specifics the Curry front desk uses to
# verify that a claimant really owns an item. If it leaks to the feed, the
# feature is worse than useless — students would believe a detail is private
# while it is on screen.
#
# Two ways that leak happens, and this script checks for both:
#
#   1. A frontend file reads the column. Only the staff dashboard should.
#   2. A backend query goes back to select("*") on listings. The column would
#      then ship to every authenticated client automatically, silently, with
#      no code obviously wrong at the call site. This is the regression the
#      feature is most vulnerable to, because select("*") is the lazy default.
#
# Run locally:  bash scripts/check-internal-leak.sh
# Runs in CI:   .github/workflows/ci.yml (backend-tests job)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/my-app/src"
BACKEND="$ROOT/my-app/backend"

fail=0

# ── 1. Frontend reads, outside the staff dashboard ──────────────────────────
if [ -d "$SRC" ]; then
  hits="$(grep -rn --include='*.js' --include='*.jsx' \
            'description_internal' "$SRC" 2>/dev/null \
          | grep -v '/pages/dashboard/' \
          | grep -v '/components/dashboard/' || true)"
  if [ -n "$hits" ]; then
    echo "ERROR: description_internal referenced outside the staff dashboard:"
    echo "$hits"
    echo
    echo "Staff-only text belongs in my-app/src/pages/dashboard/ or"
    echo "my-app/src/components/dashboard/, which are moderator-gated."
    fail=1
  fi
fi

# ── 2. A listings query that went back to select("*") ───────────────────────
# The projection lives in PUBLIC_LISTING_COLUMNS / STAFF_LISTING_COLUMNS in
# backend/routes/listings.js. A bare star anywhere near a listings query means
# someone reintroduced the leak.
if [ -d "$BACKEND" ]; then
  star_hits="$(grep -rn --include='*.js' -A3 'from("listings")' "$BACKEND" 2>/dev/null \
               | grep -E 'select\("\*' || true)"
  if [ -n "$star_hits" ]; then
    echo "ERROR: a listings query uses select(\"*\"), which ships description_internal"
    echo "to every client the moment the column exists:"
    echo "$star_hits"
    echo
    echo "Use PUBLIC_LISTING_COLUMNS (or STAFF_LISTING_COLUMNS behind"
    echo "requireModerator) from backend/routes/listings.js instead."
    fail=1
  fi
fi

# ── 3. ANY client-side query against listings ───────────────────────────────
# Today the frontend never touches this table — the feed goes through apiFetch
# to the backend's service-role client, and the anon key is only used for
# profiles and blocked_users. That is the only reason we can skip a
# column-level GRANT on listings (see the commented block at the bottom of
# migrations/sensitive_content_screening.sql).
#
# So the moment someone adds supabase.from("listings") in frontend code, that
# assumption is void: the anon key has table-level SELECT, and a select("*")
# there would return description_internal straight to the browser. Check 2
# above only scans the backend, so this is the gap it cannot see.
#
# If you genuinely need a client-side listings query, run the column-level
# GRANT block in that migration FIRST, then relax this check.
if [ -d "$SRC" ]; then
  client_hits="$(grep -rn --include='*.js' --include='*.jsx' \
                   'from("listings")' "$SRC" 2>/dev/null || true)"
  if [ -n "$client_hits" ]; then
    echo "ERROR: frontend code queries the listings table directly:"
    echo "$client_hits"
    echo
    echo "The anon key has table-level SELECT on listings, so this can return"
    echo "description_internal to the browser. Go through the backend API"
    echo "instead, or apply the column-level GRANT first (see"
    echo "my-app/backend/migrations/sensitive_content_screening.sql)."
    fail=1
  fi
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi

echo "OK: no description_internal leak paths found."
