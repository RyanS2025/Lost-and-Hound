# Lost & Hound

A lost and found web application created by Northeastern University students. This platform is **not officially affiliated with or endorsed by Northeastern University**—it is an independent student-made project. Users can post lost or found items, browse listings by category or location, view items on an interactive campus map, and message other students directly.

> **Disclaimer:** Lost & Hound is a student-made project and is not an official Northeastern University service.

---

## Features

- **Authentication** — Sign up and log in with `@northeastern.edu` email addresses via Supabase Auth, with Terms & Conditions acceptance required before account creation
- **Two-Factor Authentication** — TOTP-based MFA required on every login; trusted-device tokens skip re-prompt on known devices
- **Feed** — Browse, search, filter, and sort listings; create new posts with photo uploads, building selection, and map pin placement
- **Map** — Google Maps-powered item map with campus switching, location search, search radius filtering, and claim/report actions
- **Messages** — Real-time direct messaging tied to listings, including conversation close/hide behavior
- **Reporting & Moderation** — Report posts/users, review in moderator queues, and apply decision workflows with ban reversal
- **Account Safety** — Temporary or permanent bans enforced server-side
- **Settings** — Manage name, password reset, theme preference (light/dark/auto), and default campus
- **Auto-expiry** — Old listings are automatically cleaned up server-side

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite |
| UI Components | Material UI (MUI) v7 |
| Routing | React Router DOM v7 |
| Backend API | Express 5 |
| Security Headers | Helmet |
| Auth / Database / Storage | Supabase |
| Maps | Google Maps JS API |
| Rate Limiting | express-rate-limit |

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
- Real-time messaging uses Supabase Realtime on the frontend
- All data operations go through the Express API
- This is a student-made project and is not an official Northeastern University service

---

## License

Created for Oasis @ Northeastern (student project)