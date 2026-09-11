#!/usr/bin/env bash
#
# Guard: the description splitter's two copies must stay byte-identical.
#
# WHY: the create form shows a live "what everyone else will see" preview as
# the student types. Round-tripping every keystroke to the backend would lag
# the cursor, and a preview endpoint would be a new authenticated surface whose
# entire purpose is to be a redaction oracle. So the module is duplicated:
#
#   my-app/backend/lib/descriptionSplitter.js   ← canonical, the security boundary
#   my-app/src/utils/descriptionSplitter.js     ← byte-identical copy for the UI
#
# The repo already does this for profanityFilter.js — and those two copies HAVE
# drifted (the frontend one grew an extra export). That is the cautionary
# evidence: a duplicated security rule has to be enforced, not trusted. If the
# preview disagrees with the server, students are shown a public description
# that is not the one that gets stored.
#
# The copy is only possible because the module imports nothing, so this script
# checks that too.
#
# Run locally:  bash scripts/check-splitter-sync.sh
# Runs in CI:   .github/workflows/ci.yml (backend-tests job)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CANONICAL="$ROOT/my-app/backend/lib/descriptionSplitter.js"
COPY="$ROOT/my-app/src/utils/descriptionSplitter.js"

fail=0

for f in "$CANONICAL" "$COPY"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: missing $f"
    exit 1
  fi
done

if ! cmp -s "$CANONICAL" "$COPY"; then
  echo "ERROR: the two descriptionSplitter.js copies have drifted."
  echo
  diff -u "$CANONICAL" "$COPY" || true
  echo
  echo "Fix with:"
  echo "  cp my-app/backend/lib/descriptionSplitter.js my-app/src/utils/descriptionSplitter.js"
  fail=1
fi

if grep -nE '^[[:space:]]*(import|export[[:space:]]+\{[^}]*\}[[:space:]]+from|const[[:space:]]+[A-Za-z_$]+[[:space:]]*=[[:space:]]*require)\b' "$CANONICAL"; then
  echo
  echo "ERROR: descriptionSplitter.js must stay import-free."
  echo "It runs unchanged in Node and in the iOS Capacitor WebView, and the"
  echo "byte-identical copy above is only possible while it has no dependencies."
  echo "Inline what you need instead (see INVISIBLE_RE, which deliberately"
  echo "mirrors lib/validation.js rather than importing it)."
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi

echo "OK: descriptionSplitter.js copies are identical and dependency-free."
