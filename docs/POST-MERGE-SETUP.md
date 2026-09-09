# Post-Merge Setup Guide

After the `ryan/team-ready-refactor` branch is merged, complete these steps to finish the migration. Do them in the recommended order at the bottom of this doc.

---

## 1. Create the Dev Supabase Project -- Done !

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

6. **Seed sample data** — first create test users in the Supabase dashboard, then run the SQL below in the SQL Editor.

   **Create test auth users first** (Authentication → Users → Add User):

   | Email | Password | Note |
   |-------|----------|------|
   | `testuser1@test.com` | `TestPass123!` | Regular user (poster) |
   | `testuser2@test.com` | `TestPass123!` | Regular user (finder) |
   | `testmod@test.com` | `TestPass123!` | Moderator |

   After creating them, copy each user's UUID from the dashboard and replace the placeholders in the SQL below.

   ```sql
   -- ============================================================
   -- SEED DATA FOR DEV SUPABASE
   -- Replace these UUIDs with the real ones from Authentication → Users
   -- ============================================================

   -- Step 0: Set your user IDs (paste real UUIDs here)
   DO $$
   DECLARE
     user1_id uuid := '00000000-0000-0000-0000-000000000001'; -- testuser1@test.com
     user2_id uuid := '00000000-0000-0000-0000-000000000002'; -- testuser2@test.com
     mod_id   uuid := '00000000-0000-0000-0000-000000000003'; -- testmod@test.com
   BEGIN

   -- Step 1: Profiles
   INSERT INTO profiles (id, first_name, last_name, default_campus, is_moderator, is_owner, points, referral_answered, email_notifications_enabled, push_notifications_enabled, broadcast_notifications_enabled)
   VALUES
     (user1_id, 'Alex',  'Demo',    'boston', false, false, 0,  true, true, true, true),
     (user2_id, 'Jamie', 'Tester',  'boston', false, false, 10, true, true, true, true),
     (mod_id,   'Mod',   'Account', 'boston', true,  false, 50, true, true, true, true)
   ON CONFLICT (id) DO NOTHING;

   -- Step 2: Locations (campus buildings)
   INSERT INTO locations (name, coordinates, campus)
   VALUES
     ('Snell Library',         '42.3384,-71.0880', 'boston'),
     ('Curry Student Center',  '42.3390,-71.0897', 'boston'),
     ('ISEC',                  '42.3372,-71.0884', 'boston'),
     ('Marino Center',         '42.3401,-71.0905', 'boston'),
     ('Shillman Hall',         '42.3395,-71.0879', 'boston'),
     ('Ell Hall',              '42.3399,-71.0888', 'boston'),
     ('International Village', '42.3369,-71.0905', 'boston'),
     ('West Village H',       '42.3376,-71.0924', 'boston')
   ON CONFLICT DO NOTHING;

   -- Step 3: Listings (mix of found and lost items)
   INSERT INTO listings (title, category, location_id, found_at, importance, description, listing_type, resolved, poster_id, poster_name, date)
   VALUES
     ('Blue North Face Backpack',  'bags',        (SELECT location_id FROM locations WHERE name = 'Snell Library' LIMIT 1),         'First floor near printers', 3, 'Navy blue North Face backpack with a laptop and notebooks inside. Found on a chair near the printing station.', 'found', false, user1_id, 'Alex Demo',    NOW() - INTERVAL '2 days'),
     ('AirPods Pro Case',          'electronics', (SELECT location_id FROM locations WHERE name = 'Curry Student Center' LIMIT 1),  'Dunkin counter',            2, 'White AirPods Pro case, no name on it. Left on the counter at Dunkin.', 'found', false, user1_id, 'Alex Demo',    NOW() - INTERVAL '1 day'),
     ('Gold Hoop Earring',         'accessories', (SELECT location_id FROM locations WHERE name = 'Marino Center' LIMIT 1),         'Women''s locker room',      1, 'Single gold hoop earring found on the bench in the locker room.', 'found', false, user2_id, 'Jamie Tester', NOW() - INTERVAL '3 days'),
     ('TI-84 Calculator',          'electronics', (SELECT location_id FROM locations WHERE name = 'Shillman Hall' LIMIT 1),         'Room 105 after lecture',    2, 'TI-84 Plus CE graphing calculator, has a small scratch on the screen. Found under a desk.', 'found', false, user2_id, 'Jamie Tester', NOW() - INTERVAL '12 hours'),
     ('Red Hydroflask',            'bottles',     (SELECT location_id FROM locations WHERE name = 'ISEC' LIMIT 1),                  'Second floor study area',   1, 'Red 32oz Hydroflask with stickers on it. Left on a table.', 'found', true,  user1_id, 'Alex Demo',    NOW() - INTERVAL '5 days'),
     ('Student ID Card',           'ids',         (SELECT location_id FROM locations WHERE name = 'Ell Hall' LIMIT 1),              'Hallway outside room 312',  3, 'Northeastern student ID card. Not posting the name for privacy — DM me to verify.', 'found', false, mod_id,   'Mod Account',  NOW() - INTERVAL '6 hours'),
     ('Lost Black Wallet',         'wallets',     (SELECT location_id FROM locations WHERE name = 'International Village' LIMIT 1), 'Somewhere in IV',           3, 'Lost my black leather wallet somewhere in International Village. Has my Charlie card and debit card inside. Please help!', 'lost', false, user2_id, 'Jamie Tester', NOW() - INTERVAL '1 day'),
     ('Missing Lab Notebook',      'other',       (SELECT location_id FROM locations WHERE name = 'ISEC' LIMIT 1),                  'ISEC 3rd or 4th floor',     2, 'Green lab notebook for CHEM 2311. I think I left it in one of the study rooms. Has my name on the cover.', 'lost', false, user1_id, 'Alex Demo',    NOW() - INTERVAL '4 hours');

   -- Step 4: A conversation between user1 and user2 about the backpack
   INSERT INTO conversations (listing_id, participant_1, participant_2)
   VALUES
     ((SELECT item_id FROM listings WHERE title = 'Blue North Face Backpack' LIMIT 1), user2_id, user1_id);

   -- Step 5: Messages in that conversation
   INSERT INTO messages (conversation_id, sender_id, content, read, is_system)
   VALUES
     ((SELECT id FROM conversations LIMIT 1), user2_id, 'Hey! I think that might be my backpack. It has a red keychain on the zipper — does that match?', true,  false),
     ((SELECT id FROM conversations LIMIT 1), user1_id, 'Yes it does! When can you pick it up?',                                                         true,  false),
     ((SELECT id FROM conversations LIMIT 1), user2_id, 'I can come by Snell in about an hour. Want to meet at the front desk?',                         false, false);

   -- Step 6: A sample report (so moderator dashboard has data)
   INSERT INTO reports (reporter_id, reported_listing_id, reason, details, status)
   VALUES
     (user2_id,
      (SELECT item_id FROM listings WHERE title = 'Red Hydroflask' LIMIT 1),
      'spam',
      'This listing looks like a duplicate.',
      'pending');

   -- Step 7: A support ticket
   INSERT INTO support_tickets (user_id, name, email, ticket_type, category, ticket_title, ticket_desc, ticket_code, status)
   VALUES
     (user1_id, 'Alex Demo', 'testuser1@test.com', 'Bug Report', 'general', 'Map not loading on iOS', 'The map page shows a blank white screen on my iPhone 14. Works fine on desktop.', '12345', 'open');

   END $$;
   ```

   > **Tip:** If you need to re-seed, run `TRUNCATE profiles, listings, locations, conversations, messages, reports, support_tickets, hidden_conversations, blocked_users CASCADE;` first, then re-run the seed script.

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
