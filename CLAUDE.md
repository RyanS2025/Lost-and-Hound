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
- **Real-time**: Supabase Realtime subscriptions for live feed updates, messaging, and dashboard sync.

## Important Constraints

- Never `await` Supabase calls (or `apiFetch`) inside `onAuthStateChange` callbacks — it causes auth lock deadlocks. Wrap async work in `setTimeout(fn, 0)`.
- iOS keyboard handling uses `translateY` on the outer container with `KeyboardResize.None`. Do not use scroll-reset or input overlays.
- The app name is "Lost & Hound" — "Oasis" is the GitHub org, not the product name.
- iOS is the primary mobile target (App Store). Android is deferred but keep code compatible.

## Database

Supabase PostgreSQL with Row-Level Security on all tables. No ORM — raw Supabase client queries. Key tables: profiles, listings, locations, conversations, messages, reports, support_tickets, push_tokens, finance_config.

## Testing

```bash
cd my-app && npx playwright test --config=tests/playwright.config.js
```

Backend syntax check: `node --check my-app/backend/server.js`

## Git Rules

- Do not commit `.env` files or anything in `sensitive-info/`
- Do not run `git commit` or `git add` — the user handles all git operations
- Branch off `main` for all work
