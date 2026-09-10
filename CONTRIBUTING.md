# Contributing to Lost & Hound

## Access Tiers

| Tier | Who | Permissions |
|------|-----|-------------|
| **Core** | @RyanS2025, @AitchesonS06, @hailube, @LiamPulsifer, @NahomHaile | Production secrets, deploy access, PR merge |
| **Contributor** | Oasis Accelerator members + invited collaborators | Dev Supabase credentials, open PRs, push branches |

Contributors **do not** have access to production environment variables, Railway, or Supabase production. All PRs require at least one core team review before merging.

---

## Prerequisites

- **Node.js 20+** and **npm**
- Git

---

## Repository Structure

```
s26-group-1/
  my-app/                    # Main application
    src/                     # React 19 + Vite frontend
      pages/                 # Route pages (Feed, Map, Messages, etc.)
      components/            # Reusable UI components
      utils/                 # apiFetch, profanityFilter, etc.
      contexts/              # React contexts
    backend/                 # Express 5 API server
      server.js              # App bootstrap — mounts routes, middleware, cron
      routes/                # Route modules (auth, listings, messages, etc.)
      middleware/             # Auth guards, rate limiters
      lib/                   # Shared utilities (supabase client, email, validation)
    ios/                     # Capacitor iOS project (App Store)
    tests/                   # Playwright E2E tests
  .github/                   # CI/CD workflows, PR template
```

---

## Getting Started

### 1. Clone and install

```bash
git clone git@github.com:LostAndHound/s26-group-1.git
cd s26-group-1

# Install frontend dependencies
cd my-app
npm install

# Install backend dependencies
cd backend
npm install
cd ../..
```

### 2. Set up environment variables

**Frontend** — copy and fill in `my-app/.env`:
```bash
cp my-app/.env.example my-app/.env
```

**Backend** — copy and fill in `my-app/backend/.env`:
```bash
cp my-app/backend/.env.example my-app/backend/.env
```

**Getting credentials:**
- **Contributors**: Ask a core team member for the shared dev Supabase URL and anon/service-role keys. These point to a development-only project — not production.
- **Core team**: Use the production credentials from Railway/Supabase dashboards.

### 3. Run locally

Open two terminals:

```bash
# Terminal 1 — Backend
cd my-app/backend
node server.js
# Runs on http://localhost:3001

# Terminal 2 — Frontend (Vite dev server)
cd my-app
npm run dev
# Runs on http://localhost:5173
```

Visit `http://localhost:5173` — the frontend proxies API calls to `localhost:3001`.

### 4. Run tests

```bash
cd my-app
npx playwright test --config=tests/playwright.config.js
```

Tests use mocked Supabase auth — no real API calls.

---

## Pull Request Workflow

1. **Branch off `main`**: `git checkout -b your-name/short-description`
2. **Keep branches focused**: One feature or fix per PR
3. **Lint before pushing**: `cd my-app && npm run lint`
4. **Open a PR** using the template — fill in what it does and how to test
5. **Wait for review** from a core team member
6. **Do not merge your own PR** — a core team member will merge after approval

### Branch naming

```
<your-name>/<short-description>
```

Examples: `ryan/fix-login-redirect`, `shamar/leaderboard-tiers`, `ben/map-filter`

---

## Code Style

- **ESLint** config is at `my-app/eslint.config.js` — run `npm run lint` before pushing
- **No TypeScript** — the codebase is JavaScript (JSX for React)
- Follow existing patterns in the codebase
- Keep route handlers in their respective `routes/*.js` file
- Shared utilities go in `backend/lib/`, auth/rate-limiting middleware in `backend/middleware/`

---

## Environment Variables

Never commit `.env` files. If you add a new env var:

1. Add it to the relevant `.env.example` with a comment
2. Mention it in your PR description
3. Tell a core team member so they can set it in Railway

---

## Backend Architecture

The Express server is organized into route modules under `backend/routes/`. Each file exports an Express Router.

| Module | Routes | Description |
|--------|--------|-------------|
| `stats.js` | `/api/stats/*`, `/api/referral*` | Public stats, referral tracking |
| `auth.js` | `/api/auth/*` | Device trust, password reset |
| `passkeys.js` | `/api/passkeys/*` | WebAuthn/passkey registration and login |
| `profile.js` | `/api/profile*`, `/api/settings/*` | User profile CRUD |
| `listings.js` | `/api/listings/*`, `/api/upload-url/*`, `/api/verify-image/*` | Lost & found listings, image upload |
| `locations.js` | `/api/locations` | Campus building data |
| `messages.js` | `/api/conversations/*`, `/api/messages/*` | Real-time messaging |
| `blocking.js` | `/api/blocked-ids`, `/api/users/*/block` | User blocking |
| `reports.js` | `/api/reports/*`, `/api/mod/*` | Content moderation |
| `support.js` | `/api/support*`, `/api/support-tickets/*` | Help tickets, feedback, bugs |
| `dashboard.js` | `/api/dashboard/*` | Moderator dashboard summary |
| `push.js` | `/api/push-tokens`, `/api/push/*` | Push notification management |
| `finances.js` | `/api/finances/*` | Owner billing dashboard |

### Auth middleware chain

Most routes use this middleware stack:
```
requireAuth → require2FA → [requireModerator|requireOwner|requireNotBanned]
```

- `requireAuth` — validates Supabase JWT from `Authorization: Bearer <token>`
- `require2FA` — checks device trust token or AAL2 session
- `requireModerator` / `requireOwner` — role-based access
- `requireNotBanned` — blocks suspended users from write actions

---

## For Repo Admins

### Branch protection (GitHub settings)

- Require 1 PR review from `@LostAndHound/core` before merge
- Require lint status check to pass
- Disable direct pushes to `main`
- Restrict merge to core team members
