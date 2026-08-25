# Post-Merge Setup Guide

After the `ryan/team-ready-refactor` branch is merged, complete these steps to finish the migration. Do them in the recommended order at the bottom of this doc.

---

## 1. Create the Dev Supabase Project

This is a free-tier Supabase project that contributors use for local development. It keeps production data safe.

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and click **New Project**
2. Name it `lost-and-hound-dev` (keep it obviously separate from prod)
3. Pick the **Free tier**, choose any region, set a database password
4. Once created, go to **Settings → API** and copy:
   - **Project URL** → dev `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - **anon public key** → dev `VITE_SUPABASE_ANON_KEY`
   - **service_role secret key** → dev `SUPABASE_SERVICE_ROLE_KEY`

5. **Recreate your tables** — go to the SQL Editor in the dev project and run table creation queries. You can get the schema from production Supabase:
   - In your **production** Supabase dashboard → SQL Editor → run:
     ```sql
     SELECT
       'CREATE TABLE ' || tablename || ' (' ||
       string_agg(column_name || ' ' || data_type, ', ') || ');'
     FROM information_schema.columns
     WHERE table_schema = 'public'
     GROUP BY tablename;
     ```
   - Or: go to **Table Editor** in prod, note each table's columns, and recreate them in dev
   - Enable **Row Level Security** on each table (even for dev — keeps behavior consistent)

6. **Seed sample data** — insert a few test users, listings, and locations so contributors have something to work with

7. **Share credentials with contributors** — send them the dev URL + anon key + service role key via a pinned Slack/Discord message or shared doc (not in the repo). These are safe to share since the dev project has no real user data.

---

## 2. Test the Full Deploy

### Local test (do this first)

```bash
# Build the frontend
cd my-app
npm run build

# Start the backend (which now serves the frontend too)
cd backend
node server.js
```

Open `http://localhost:3001` in your browser and verify:

- [ ] The SPA loads (you see the login page)
- [ ] Click through pages — client-side routing works (no 404s on /feed, /map, /messages, etc.)
- [ ] Open DevTools → Network tab → API calls go to the same origin (no CORS errors)
- [ ] Open DevTools → check response headers for CSP, HSTS, X-Frame-Options
- [ ] Try logging in if you have local env vars pointing to prod (or dev) Supabase

### Deploy to Railway

**Option A — GitHub Actions (recommended for production):**

1. Make sure all changes are committed and pushed
2. Go to GitHub → Actions → **Deploy Lost & Hound**
3. Click **Run workflow** → select `production` → run
4. Watch the logs — the `lint` job runs first, then `deploy`

**Option B — Railway CLI (for quick testing):**

```bash
# Install Railway CLI if you don't have it
npm i -g @railway/cli

# Login
railway login

# Link to your project (first time only)
railway link

# Deploy
railway up --detach --service "Lost & Hound Backend"
```

### Verify the deploy

After deploy completes, visit your Railway URL (`*.up.railway.app`) and check:

- [ ] SPA loads at the root URL
- [ ] Navigate to `/feed`, `/map`, `/messages` — all work without 404
- [ ] Login works
- [ ] API works: visit `https://your-app.up.railway.app/api/stats/user-count` — should return JSON
- [ ] Test on your phone / iOS simulator to make sure Capacitor app still connects

**Only proceed to DNS cutover after all checks pass.**

---

## 3. Update DNS (thelostandhound.com → Railway)

1. In your **Railway dashboard**, open your project → click the backend service
2. Go to **Settings → Networking → Public Networking**
3. Click **"Generate Domain"** if you don't have one, or note your existing `*.up.railway.app` URL
4. Click **"Add Custom Domain"** → enter `thelostandhound.com`
5. Railway will show you DNS records to add (typically a `CNAME` record)

6. Go to your **domain registrar** (wherever you bought the domain):
   - Find DNS settings
   - **Remove** the existing records pointing to Vercel
   - **Add** the record(s) Railway gave you
   - For both `www` and non-www support:
     - `CNAME` for `www` → Railway's domain
     - For the root (`@`), follow Railway's instructions (usually a `CNAME` or `A` record)

7. DNS propagation takes 5 minutes to 48 hours (usually under 30 minutes)

8. After DNS propagates, Railway auto-provisions an **SSL certificate** — verify by visiting `https://thelostandhound.com`

9. **Update your backend environment variables** on Railway:
   - `ALLOWED_ORIGINS` = `https://thelostandhound.com,https://www.thelostandhound.com,capacitor://localhost`
   - `PASSKEY_RP_ID` = `thelostandhound.com`
   - `PASSKEY_ORIGIN` = `https://thelostandhound.com,https://www.thelostandhound.com`

---

## 4. Remove Old Vercel Secrets from GitHub

1. Go to your repo on GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Under **Repository secrets**, delete:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
3. **Keep** `RAILWAY_TOKEN` — the deploy workflow still uses it

---

## 5. Enable Status Check Requirement

After your first PR successfully runs the lint CI job:

1. Go to GitHub → repo **Settings** → **Rules** → your `main` branch ruleset
2. Enable **Require status checks to pass**
3. Search for and select the `lint` job
4. Now every PR must pass lint before merging

---

## 6. Set Up Shared Dev Backend for Contributors

This is how contributors use the full app (with working APIs) without ever seeing your keys.

### How it works

```
Contributor's machine              Railway (you control)
┌─────────────────────┐           ┌─────────────────────────┐
│  Frontend (Vite)    │  ──API──▶ │  Dev Backend (Express)  │
│  localhost:5173     │           │  All API keys loaded    │
│                     │           │  Points to dev Supabase │
│  Only needs:        │           │                         │
│  - VITE_SUPABASE_URL│           │  Has (contributors      │
│  - VITE_ANON_KEY    │           │  never see these):      │
│  - VITE_MAPS_KEY    │           │  - SERVICE_ROLE_KEY     │
│  - VITE_API_URL     │           │  - RESEND_API_KEY       │
│    (points here ──────────────▶ │  - GOOGLE_VISION_KEY    │
└─────────────────────┘           │  - ONESIGNAL keys       │
                                  └─────────────────────────┘
```

Contributors only need 4 frontend env vars (all public/client-safe). The backend runs on Railway with all the secret keys — contributors never see them.

### Step-by-step

1. **Create a dev environment in Railway:**
   - Open your Railway project dashboard
   - Click **"Environments"** (top bar) → **"New Environment"** → name it `dev`
   - This creates an isolated copy of your service with its own env vars and URL

2. **Set env vars on the dev environment:**
   - `SUPABASE_URL` → your **dev** Supabase project URL (from step 1 above)
   - `SUPABASE_SERVICE_ROLE_KEY` → your **dev** Supabase service role key
   - `ALLOWED_ORIGINS` → `http://localhost:5173,http://localhost:3001`
   - `RESEND_API_KEY` → same as prod (or leave blank — emails just won't send)
   - `GOOGLE_CLOUD_VISION_API_KEY` → same as prod (or leave blank — image moderation skips)
   - `ONESIGNAL_APP_ID` / `ONESIGNAL_REST_API_KEY` → leave blank (push won't send — that's fine for dev)
   - `PASSKEY_RP_ID` → `localhost`
   - `PASSKEY_ORIGIN` → `http://localhost:5173`

3. **Deploy the dev backend:**
   ```bash
   railway up --detach --service "Lost & Hound Backend" --environment dev
   ```
   Note the URL it gives you (e.g., `https://lost-and-hound-backend-dev.up.railway.app`)

4. **Tell contributors to set up their local `.env`:**

   `my-app/.env`:
   ```env
   VITE_SUPABASE_URL=<dev supabase URL>
   VITE_SUPABASE_ANON_KEY=<dev supabase anon key>
   VITE_GOOGLE_MAPS_API_KEY=<your maps key — this is a client-side key, already visible in the browser bundle>
   VITE_API_URL=https://lost-and-hound-backend-dev.up.railway.app
   ```

   That's it. They do NOT need `my-app/backend/.env` at all — they don't run the backend locally.

5. **Contributors just run:**
   ```bash
   cd my-app
   npm install
   npm run dev
   ```
   The frontend runs at `localhost:5173` and all API calls go to the Railway dev backend.

### What about backend development?

When a contributor needs to modify backend code (routes, middleware, etc.):

- They **can** run the backend locally with the dev Supabase keys (URL + anon key + service role key — these are safe to share since it's a dev-only project)
- Email, push notifications, and image moderation won't work locally (the code gracefully skips when those keys are missing)
- They test their backend changes locally, then open a PR
- After the PR merges, you redeploy the dev backend to pick up the changes

### What contributors get vs. don't get

| They get (safe to share) | They never see |
|--------------------------|----------------|
| Dev Supabase URL | Production Supabase URL |
| Dev Supabase anon key | Any service role key |
| Google Maps JS API key (already public in browser) | Google Cloud Vision key |
| Dev backend URL on Railway | Resend API key |
| | OneSignal keys |
| | Railway API token |

---

## 7. Set Up Automated PR Reviewers

Two free AI reviewers that auto-review every PR:

### GitHub Copilot Code Review (free via GitHub Education)

1. Go to repo **Settings → Rules → your `main` branch ruleset**
2. Enable **"Automatically request Copilot code review"**
3. Copilot will leave inline review comments on every PR

### CodeRabbit (free tier — 200 reviews/month)

1. Go to [coderabbit.ai](https://coderabbit.ai) → sign in with GitHub
2. Install the GitHub App on your org/repo
3. It auto-reviews every PR with a summary + line-by-line comments
4. Team members can `@coderabbitai` in PR comments for follow-up questions

Both run on every PR with zero ongoing maintenance.

---

## Recommended Order

| Step | What | Risk | Dependencies |
|------|------|------|-------------|
| 1 | Create dev Supabase project | None | Independent — do anytime |
| 2 | Test locally (build + serve from Express) | None | Just your machine |
| 3 | Deploy to Railway and test at `*.up.railway.app` | Low | Step 2 passed |
| 4 | Remove Vercel secrets from GitHub | None | Independent — do anytime |
| 5 | DNS cutover (`thelostandhound.com` → Railway) | **Medium** | Step 3 passed and verified |
| 6 | Set up shared dev backend on Railway | None | Step 1 done (dev Supabase exists) |
| 7 | Enable lint status check | None | After first PR with the new workflow runs |
| 8 | Set up Copilot + CodeRabbit PR reviewers | None | After org/repo is set up |
