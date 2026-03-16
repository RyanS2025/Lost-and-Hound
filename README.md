# Lost & Hound

A lost and found web application built for Northeastern University students. Users can post lost or found items, browse listings by category or location, view items on an interactive campus map, and message other students directly.

---

## Features

- **Authentication** — Sign up and log in with `@northeastern.edu` email addresses via Supabase Auth, with Terms & Conditions acceptance required before account creation
- **Two-Factor Authentication** — TOTP-based MFA (Duo recommended) required on every login; trusted-device tokens (SHA-256 hashed, 24hr/30-day TTL) skip re-prompt on known devices
- **Feed** — Browse, search, filter, and sort listings; create new posts with photo uploads, building selection, and map pin placement
- **Map** — Google Maps-powered item map with campus switching, location search, search radius filtering, and claim/report actions
- **Messages** — Real-time direct messaging tied to listings, including conversation close/hide behavior
- **Reporting & Moderation** — Report posts/users (including stolen/theft concerns), review in grouped moderator queues, inspect per-report details in a modal, and apply decision workflows with ban reversal
- **Account Safety** — Temporary (3/30 day) or permanent bans enforced server-side using profile ban fields
- **Settings** — Manage name, password reset, theme preference (light/dark/auto), and default campus
- **Auto-expiry** — Resolved listings older than 30 days are automatically cleaned up server-side (runs at most once per hour)

---

## Architecture

```
Browser (React + Vite)
   │
   │  fetch() with Bearer token
   ▼
Express API Server (server.js)
   │
   │  Service Role Key (hidden)
   ▼
Supabase (Auth, Database, Storage)
```

The frontend never talks to Supabase directly for data operations. All queries go through the Express backend, which validates auth tokens, enforces bans, checks authorization, and applies rate limiting before touching the database. The only client-side Supabase usage is for auth flows (sign-up, sign-in, sign-out, password reset) and real-time WebSocket subscriptions for live messaging.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite |
| UI components | Material UI (MUI) v7 |
| Routing | React Router DOM v7 |
| Backend API | Express 5 |
| Security headers | helmet |
| Auth / Database / Storage | Supabase |
| Maps | Google Maps JS API (`@googlemaps/js-api-loader`) |
| Rate limiting | express-rate-limit |

---

## Project Structure

```
my-app/
├── backend/
│   ├── server.js              # Express API server (all routes)
│   ├── supabaseClient.js      # Frontend Supabase client (auth + realtime only)
│   ├── package.json           # Backend dependencies
│   └── .env                   # Backend secrets (SUPABASE_URL, SERVICE_ROLE_KEY)
├── public/                    # Static assets
├── src/
│   ├── App.jsx                # App shell, navigation, theme mode, and routes
│   ├── AuthContext.jsx        # Auth + profile state (moderator, ban, campus)
│   ├── components/
│   │   ├── button.jsx         # Reusable button component
│   │   ├── MapPinPicker.jsx   # Inline map widget for selecting coordinates
│   │   ├── ReportModal.jsx    # Shared report form for posts/users
│   │   └── TermsModal.jsx     # Terms & Conditions modal for sign-up
│   ├── constants/
│   │   └── campuses.js        # Campus metadata used by map/settings/feed
│   ├── pages/
│   │   ├── DashboardPage.jsx  # Moderator dashboard (reports + actions)
│   │   ├── FeedPage.jsx       # Listings feed and create-post modal
│   │   ├── LoginPage.jsx      # Login, sign-up, and terms acceptance
│   │   ├── MapPage.jsx        # Interactive campus map view
│   │   ├── MessagePage.jsx    # Conversations and real-time chat
│   │   ├── NotFoundPage.jsx   # 404 page
│   │   └── SettingsPage.jsx   # Account + preferences
│   └── utils/
│       └── apiFetch.js        # Centralized API helper (attaches Bearer token)
├── .env                       # Frontend env vars (VITE_SUPABASE_URL, etc.)
└── package.json               # Frontend dependencies
```

---

## Security

The Express backend enforces multiple layers of protection:

- **Security headers** — `helmet` sets hardened HTTP response headers on every response (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-DNS-Prefetch-Control`, removes `X-Powered-By`, etc.)
- **Auth middleware** — Every API route verifies the Supabase JWT before processing
- **Two-factor authentication** — All protected routes require MFA (AAL2 token or valid trusted-device token); device tokens are stored as SHA-256 hashes, never plaintext
- **Rate limiting** — Three tiers: general (100/15min), write operations (20/15min), and strict (5/15min for reports and account deletion)
- **Input validation** — All text inputs are trimmed and length-capped; `category` and `campus` validated against allowlists; `lat`/`lng` validated to coordinate ranges; `image_url` validated against allowed origins to prevent SSRF; UUID regex applied to all `:id`/`:userId` route params and mod query params
- **Error message isolation** — Internal DB errors are logged server-side only; clients always receive a generic `"Internal server error"` response
- **Ban enforcement** — Banned users are blocked from creating listings, sending messages, starting conversations, uploading images, and submitting reports
- **Conversation authorization** — Only participants can view, send messages in, or close a conversation
- **Self-action prevention** — Users cannot message or report themselves
- **File type restriction** — Only image extensions (jpg, jpeg, png, webp, gif) are accepted for uploads
- **Moderator gating** — Dashboard and moderation actions require `is_moderator = true`; mod message viewer and ban-info endpoints also validate UUID params
- **Service role key isolation** — The Supabase service role key never leaves the backend server

---

## API Routes

### Profile
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/profile` | User | Fetch profile (auto-creates on first login) |
| PATCH | `/api/profile` | User | Update name |
| PATCH | `/api/profile/campus` | User | Update default campus |
| DELETE | `/api/profile` | User | Delete account |

### Listings
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/listings` | User | Fetch all listings with location join |
| POST | `/api/listings` | User + Not Banned | Create a new listing |
| PATCH | `/api/listings/:item_id/resolve` | User + Not Banned | Mark item as claimed |
| DELETE | `/api/listings/:item_id` | Moderator | Delete a listing |
| POST | `/api/listings/cleanup` | User | Remove old resolved listings (1hr cooldown) |
| POST | `/api/upload-url` | User + Not Banned | Get signed upload URL for images |

### Locations
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/locations` | User | List buildings (optional `?campus=` filter) |

### Conversations & Messages
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/conversations` | User | List conversations with profiles + listings |
| GET | `/api/conversations/:id` | Participant | Get single conversation |
| POST | `/api/conversations` | User + Not Banned | Find or create conversation |
| DELETE | `/api/conversations/:id` | Participant | Close conversation |
| GET | `/api/conversations/:id/messages` | Participant | Fetch messages |
| POST | `/api/conversations/:id/messages` | Participant + Not Banned | Send a message |

### Reports & Moderation
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/reports` | User + Not Banned | Submit a report |
| GET | `/api/reports` | Moderator | Fetch all reports (enriched with profile data, listing data, and stolen report contact context) |
| PATCH | `/api/reports/:id/status` | Moderator | Update report status |
| DELETE | `/api/reports/:id` | Moderator | Delete a report |
| POST | `/api/reports/:id/decision` | Moderator | Full decision (ban + delete content) |
| POST | `/api/reports/:id/reverse-ban` | Moderator | Reverse a ban |
| GET | `/api/reports/ban-info/:userId` | Moderator | Fetch user ban status |
| GET | `/api/mod/messages` | Moderator | View conversation between two users |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project with the required tables and storage bucket
- A [Google Maps JavaScript API](https://developers.google.com/maps) key with the Maps JS API enabled

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd my-app

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
```

### Environment Variables

**Frontend** — Create `.env` in the `my-app/` root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

**Backend** — Create `.env` in `my-app/backend/`:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
CORS_ORIGIN=http://localhost:5173
```

> **Important:** Both `.env` files must be in `.gitignore`. The service role key bypasses all Row Level Security — never commit it.

### Running Locally

You need **two terminals** — one for the backend, one for the frontend:

```bash
# Terminal 1: Start the backend
cd my-app/backend
node server.js
# → Server running on port 3001

# Terminal 2: Start the frontend
cd my-app
npm run dev
# → http://localhost:5173
```

### Building for Production

```bash
npm run build
npm run preview   # preview the production build locally
```

For production deployment, update:
- `CORS_ORIGIN` in backend `.env` to your production frontend URL
- `API_BASE` in `src/utils/apiFetch.js` to your production backend URL (single source of truth — `LoginPage` imports from there)

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |

---

## Notes

- Account registration is restricted to `@northeastern.edu` email addresses
- New users must accept Terms & Conditions before creating an account
- Password reset is handled via a Supabase-sent email link
- Theme preference supports **Light**, **Dark**, and **Default (auto/system)**
- Moderator tools are available only when `profiles.is_moderator = true`
- Moderator dashboard sections include Reports, Stolen, Feedback, Bugs, and Support (coming soon placeholders where applicable)
- Stolen/theft reports are handled in a separate queue from regular reports
- Repeated reports for the same post are grouped into one moderation card; moderators can expand to view all related reports for that post
- Related report entries in grouped cards are clickable and open a per-report review modal
- Stolen report review includes contact context when resolvable: reported person email, claimant email, and reporter email
- Suspensions are controlled through `profiles.banned_until` and `profiles.ban_reason`
- Item importance levels: **Low**, **Medium**, **High**
- Item categories: Husky Card, Jacket, Wallet/Purse, Bag, Keys, Electronics, Other
- Real-time messaging uses Supabase Realtime (WebSocket) on the frontend with the anon key
- All other data operations go through the Express API with the service role key

---

## Supabase Schema

The application expects these tables:

- **profiles**: `id`, `first_name`, `last_name`, `default_campus`, `is_moderator`, `banned_until`, `ban_reason`
- **locations**: `location_id`, `name`, `coordinates`, `campus`
- **listings**: `item_id`, `title`, `category`, `location_id`, `found_at`, `importance`, `description`, `image_url`, `resolved`, `poster_id`, `poster_name`, `date`, `lat`, `lng`
- **conversations**: `id`, `listing_id`, `participant_1`, `participant_2`
- **messages**: `id`, `conversation_id`, `sender_id`, `content`, `created_at`, `is_system`
- **reports**: `id`, `reporter_id`, `reported_listing_id`, `reported_user_id`, `reason`, `details`, `status`, `created_at`

---

## Deployment Hardening Checklist

This project currently has no known production dependency vulnerabilities from `npm audit --omit=dev` on both frontend and backend. For live deployment, apply the checklist below:

- [x] Enable secure HTTP headers (`helmet`) — `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, removes `X-Powered-By`, etc.
- [x] Centralized error handling — internal DB error details are never sent to clients
- [x] Input allowlist validation — `category`, `campus`, `lat`/`lng`, `image_url` origin, and UUID route params all validated
- [ ] Restrict CORS origins via environment configuration per environment (do not keep broad mixed local+prod origins in production).
- [ ] Add request body size limits to `express.json()` and route-specific limits for heavy payload endpoints.
- [ ] Add structured security logging for moderation actions (`/api/reports/:id/decision`, `/api/reports/:id/reverse-ban`, listing deletes) with actor ID + target ID.
- [ ] Consider stricter abuse controls on report creation (per-user and per-target cooldowns in addition to IP-based limits).
- [ ] Confirm transport security and cookie/token handling at the edge (HTTPS only, HSTS enabled at reverse proxy/CDN).
- [ ] Rotate Supabase service-role keys regularly and keep backend `.env` access tightly scoped.
- [ ] Add monitoring and alerting for spikes in auth failures, report spam, and moderator action rates.

- **hidden_conversations**: `id`, `user_id`, `conversation_id`

Storage bucket:

- **listing-images** — for uploaded listing photos (public read, authenticated upload via signed URLs)