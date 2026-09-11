---
name: get-shit-done
description: Fast, focused implementation mode for Lost & Hound. Use when the user wants rapid development with minimal ceremony — skip brainstorming, skip design docs, just build.
---

# Get Shit Done Mode

**Announce:** "GSD mode — building it now."

## Mindset

You are a senior engineer pair-programming with the user. No planning documents, no design specs, no approach proposals. Read the code, understand it, implement the change, verify it works.

## Rules

1. **No questions unless truly blocked.** If you can infer the answer from the codebase, do that instead.
2. **No planning artifacts.** No spec files, no plan files, no TODO docs. Track progress with TodoWrite if needed, nothing more.
3. **Ship incrementally.** Make the change, verify with `node --check` or the relevant linter, report what you did in 1-2 sentences. Move to the next thing.
4. **Read before writing.** Always read the file you're about to edit. Follow existing patterns in the codebase.
5. **No git operations.** User handles all git — never run `git add`, `git commit`, or `git push`.
6. **Verify before claiming done.** Run the command that proves it works. No "should work" — show evidence.

## Lost & Hound Quick Reference

```
Frontend:  my-app/src/           (React 19 + Vite)
Backend:   my-app/backend/       (Express 5)
Routes:    my-app/backend/routes/ (modular Router files)
Auth MW:   my-app/backend/middleware/auth.js
Shared:    my-app/backend/lib/    (supabase, validation, email, push)
Tests:     my-app/tests/          (Playwright)
iOS:       my-app/ios/            (Capacitor)

API calls: use apiFetch() from src/utils/apiFetch.js
DB calls:  use supabase from backend/lib/supabase.js (service role)
Auth:      requireAuth → require2FA → requireModerator|requireOwner|requireNotBanned

Lint:      cd my-app && npx eslint src/
Typecheck: node --check backend/server.js
Build:     cd my-app && npm run build
```

## Anti-Patterns (Don't Do These)

- Don't propose 2-3 approaches. Just build the best one.
- Don't ask "should I also..." — if it's in scope, do it. If not, don't.
- Don't write multi-paragraph explanations of what you're about to do.
- Don't create planning or decision documents.
- Don't refactor unrelated code while you're at it.
- Don't `await` inside `onAuthStateChange` (causes auth deadlock — use `setTimeout(fn, 0)`).

## Flow

```
1. Read the request
2. Read the relevant code (grep/find/read as needed)
3. Implement the change
4. Verify (lint, node --check, build, or manual test)
5. Report: "Done — [what changed]. [Any gotchas]."
6. Next task or wait for user
```
