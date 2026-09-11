# Lost & Hound — Claude Code Guide

## Project Overview

Lost & Hound is a campus lost-and-found platform. React 19 + Vite frontend, Express 5 backend, Supabase (PostgreSQL + Auth + Realtime + Storage), Capacitor iOS app.

Live at thelostandhound.com. iOS app in the App Store (com.lostandhound.app).

## Running Locally

```bash
# Frontend (Terminal 1)
cd my-app && npm install && npm run dev

# Backend (Terminal 2)
cd my-app/backend && npm install && node server.js
```

Frontend runs on :5173, backend on :3001. Env files: `my-app/.env` and `my-app/backend/.env` (copy from `.env.example`).

## Project Structure

```
my-app/
  src/                       # React frontend
    pages/                   # Route pages
    components/              # Reusable components
    utils/apiFetch.js        # Authenticated fetch wrapper (attaches Bearer token + device token)
    supabaseClient.js        # Frontend Supabase client (anon key, PKCE)
  backend/
    server.js                # App bootstrap — middleware, route mounting, cron jobs
    routes/                  # Express Router modules (auth, listings, messages, etc.)
    middleware/auth.js        # requireAuth, require2FA, requireModerator, requireOwner, etc.
    middleware/rateLimiters.js # Rate limiting tiers
    lib/supabase.js          # Backend Supabase client (service role key — bypasses RLS)
    lib/validation.js        # Input sanitization, profanity check, constants
    lib/email.js             # Transactional email templates (Resend)
    lib/pushNotifications.js # OneSignal push notification helpers
  ios/                       # Capacitor iOS project
  tests/                     # Playwright E2E tests
```

## Key Patterns

- **API calls from frontend**: Always use `apiFetch(path, options)` from `src/utils/apiFetch.js`. It attaches the Supabase Bearer token and device trust token automatically.
- **Backend auth chain**: Routes use `requireAuth → require2FA → [requireModerator|requireOwner|requireNotBanned]` middleware.
- **Supabase**: Frontend uses anon key (respects RLS). Backend uses service role key (bypasses RLS). Never expose the service role key client-side.
- **Real-time**: Supabase Realtime subscriptions for messaging and dashboard sync. The feed does NOT use Realtime — it fetches through `apiFetch`.
- **Image uploads** are screened before they can be attached to anything: client → `/api/upload-url` → PUT to Supabase Storage → `/api/verify-image` → attach. `/api/verify-image` returns a signed token, and the attach endpoints reject an `image_url` without one. Anything that looks like an ID, payment card or personal document is deleted and the post renders a synthetic "photo hidden" tile.
- **Descriptions are split on POST** into a public half and a desk-only half by `backend/lib/descriptionSplitter.js`. That module is duplicated byte-for-byte at `src/utils/descriptionSplitter.js` so the create form can preview the split live; `scripts/check-splitter-sync.sh` enforces the copies match, and the module must stay import-free for that to work.

## Important Constraints

- Never `await` Supabase calls (or `apiFetch`) inside `onAuthStateChange` callbacks — it causes auth lock deadlocks. Wrap async work in `setTimeout(fn, 0)`.
- iOS keyboard handling uses `translateY` on the outer container with `KeyboardResize.None`. Do not use scroll-reset or input overlays.
- The app name is "Lost & Hound" — "Oasis" is the GitHub org, not the product name.
- iOS is the primary mobile target (App Store). Android is deferred but keep code compatible.

## Coding Principles (Karpathy Rules)

These four principles apply to every task. They reduce overengineering and unnecessary diffs.

1. **Think Before Coding** — State assumptions explicitly. If multiple interpretations exist, present them. If unclear, ask before implementing.
2. **Simplicity First** — Minimum code that solves the problem. No speculative features, no abstractions for single-use code, no error handling for impossible scenarios.
3. **Surgical Changes** — Touch only what the request requires. Match existing style. Don't refactor adjacent code. Remove only orphans YOUR changes created.
4. **Goal-Driven Execution** — Transform tasks into verifiable goals. State a brief plan with success criteria. Loop until verified.

## Database

Supabase PostgreSQL with Row-Level Security on all tables. No ORM — raw Supabase client queries. Key tables: profiles, listings, locations, conversations, messages, reports, support_tickets, push_tokens, finance_config, sensitive_image_blocks.

Schema is managed by hand in the Supabase dashboard — there is no migration tooling. `backend/migrations/*.sql` are scripts you run there yourself, newest last.

**`listings.description_internal` is staff-only.** `listings.description` holds the auto-redacted public text; `description_internal` holds the original, including the specifics the Curry front desk uses to verify ownership. Never put it in a select reachable by a non-staff client — use `PUBLIC_LISTING_COLUMNS` / `STAFF_LISTING_COLUMNS` from `backend/routes/listings.js` and never `select("*")` on listings. `scripts/check-internal-leak.sh` fails the build otherwise.

## Testing

```bash
# Backend unit tests — Node's built-in runner, no extra dependencies
cd my-app/backend && npm test

# E2E. If results look nonsensical, something else may be on port 5173:
#   lsof -nP -iTCP:5173 -sTCP:LISTEN
cd my-app && npx playwright test --config=tests/playwright.config.js

# Guards that also run in CI
bash scripts/check-location-embeds.sh   # ambiguous locations embeds
bash scripts/check-splitter-sync.sh     # splitter copies byte-identical
bash scripts/check-internal-leak.sh     # description_internal never leaks
```

Backend syntax check: `node --check my-app/backend/server.js`

Note: 8 tests in `signup.spec.js`, `login.spec.js` and `navigation.spec.js` fail on `main` as of Sept 2026 — pre-existing, not caused by new work.

## Git Rules

- Do not commit `.env` files or anything in `sensitive-info/`
- Only run `git commit` / `git add` when explicitly asked — never add co-author attribution
- Branch off `main` for all work

## Claude Code Setup (All Team Members)

Use **Opus 5** (`claude-opus-5`) for work on this repo — set it with `/model` in Claude Code. `.claude/` is gitignored apart from `skills/`, so this is a per-contributor setting, not something the repo can enforce.

Every contributor should install these plugins for a consistent experience. Run these commands in Claude Code (not bash):

```
# Superpowers — brainstorming, debugging, planning, code review workflows
/plugin marketplace add anthropics/superpowers

# Superdesign — design-first frontend development, stop shipping AI-slop UI
/plugin marketplace add superdesigndev/superdesign-skill
/plugin install superdesign@superdesign

# Trail of Bits — code auditing and vulnerability detection
/plugin marketplace add trailofbits/skills

# Playwright — browser automation and E2E testing
/plugin marketplace add lackeyjb/playwright-skill
/plugin install playwright-skill@playwright-skill
```

After installing superdesign, also run:
```bash
npm install -g @superdesign/cli@latest
superdesign login
```

### Project Skills (auto-loaded from .claude/skills/)

- `/get-shit-done` — Fast implementation mode, no planning docs, just build
- `/close` — Clean session wrap-up, saves context to memory
- `/karpathy` — Coding principles reference (also baked into this file above)
