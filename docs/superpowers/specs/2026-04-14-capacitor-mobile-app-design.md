# Capacitor Mobile App — Design Spec
**Date:** 2026-04-14
**Status:** Approved

---

## Context

The existing React Native / Expo mobile app in `mobile/` is being replaced. Maintaining a parallel codebase to the website (`my-app/`) is unsustainable — it diverges rapidly, is hard to keep in sync, and produces bugs that are difficult for Claude Code to fix reliably.

The solution is to wrap the existing Vite/React website using **Capacitor**, producing App Store and Google Play builds from the same codebase. This eliminates the parallel codebase entirely, leverages Claude Code's strength with React/Vite, and keeps the website and app in perfect sync by definition.

The `mobile/` folder will be deleted as part of this work.

---

## Scope

1. **Capacitor integration** into `my-app/`
2. **Push notifications** via OneSignal (no Firebase)
3. **Demo mode** — shared across web and app, read-only interactive experience with mock data
4. **Moderator dashboard** — web-only; hidden in native app builds
5. **Deep linking** for Supabase auth emails
6. **Google Maps mobile API key** swap for Capacitor builds
7. **Delete `mobile/`**

---

## Architecture

Capacitor is installed inside `my-app/`. The build pipeline:

```
npm run build  →  my-app/dist/  →  npx cap sync  →  ios/ + android/
```

- `ios/` and `android/` folders live inside `my-app/` and are managed by Capacitor
- The app bundles the compiled `dist/` locally inside WKWebView (iOS) / WebView (Android)
- App does **not** load `thelostandhound.com` remotely — it ships the bundle, which passes App Store 4.2 review
- API calls still go to Railway backend; Supabase auth still works normally
- Google Maps JavaScript API runs unchanged — WKWebView is WebKit, same as Safari

### New folder structure inside `my-app/`
```
my-app/
├── ios/                    ← Capacitor-managed, Xcode project
├── android/                ← Capacitor-managed, Gradle project
├── capacitor.config.ts     ← Capacitor config
├── src/                    ← unchanged React/Vite source
└── ...
```

---

## Capacitor Setup

**Packages to install:**
```
@capacitor/core
@capacitor/cli
@capacitor/ios
@capacitor/android
@capacitor/app            ← deep link handling
@capacitor/push-notifications  ← native push (used by OneSignal SDK internally)
```

**`capacitor.config.ts`:**
```ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lostandhound.app',
  appName: 'Lost & Hound',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
```

**Release workflow:**
```bash
npm run build
npx cap sync
npx cap open ios     # → Xcode → Archive → Submit to App Store
```

---

## Google Maps API Key

The existing web key is restricted to `https://thelostandhound.com/*`. Inside Capacitor, the app is served from `capacitor://localhost`, which would be rejected.

User already has a separate mobile Maps API key.

**Implementation:**
- Add `VITE_GOOGLE_MAPS_API_KEY_MOBILE` to `my-app/.env`
- In the Maps initialisation code, select key based on `Capacitor.isNativePlatform()`

---

## Push Notifications — OneSignal

**No Firebase required.** OneSignal handles APNS (iOS) and FCM (Android) internally.

### One-time setup (manual, outside codebase)
1. Create OneSignal account → new app → get **App ID** and **REST API Key**
2. Upload APNS Auth Key from Apple Developer account to OneSignal dashboard
3. OneSignal handles Android FCM under the hood

### Credentials
```
# my-app/.env
VITE_ONESIGNAL_APP_ID=...

# Railway backend env
ONESIGNAL_REST_API_KEY=...
```

### Frontend — `usePushNotifications` hook
Location: `my-app/src/hooks/usePushNotifications.js`

- Initialises OneSignal SDK on app mount (native only — no-ops on web)
- On login: retrieves OneSignal Player ID → POST to `/api/push/register` with user ID
- On logout: POST to `/api/push/unregister` to disassociate token

### Backend — Express routes (Railway)
New file: `my-app/backend/routes/push.js`

- `POST /api/push/register` — stores `{ user_id, onesignal_player_id }` in Supabase `push_tokens` table
- `POST /api/push/unregister` — removes token for user
- `sendPushNotification(userId, title, body)` — utility that queries player ID from Supabase → POSTs to OneSignal REST API

### Supabase schema addition
```sql
CREATE TABLE push_tokens (
  user_id uuid REFERENCES auth.users PRIMARY KEY,
  player_id text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
```

### Push trigger points in existing backend
Add `sendPushNotification` calls at:
- New message received (`server.js` message creation handler)
- Item marked as found/returned
- (Future) Any moderation action on user's listing

---

## Demo Mode

A shared `isDemoMode` flag written once, works identically on web and in the Capacitor app. Entry points differ only in UX; all logic is shared.

### Entry points
- **Web login page**: "Try Demo" button below the sign-in form
- **App login screen**: Same "Try Demo" button — identical code path

### `DemoContext`
Location: `my-app/src/contexts/DemoContext.jsx`

- Provides `isDemoMode` boolean and `enterDemo()` / `exitDemo()` functions
- Wraps the app at the same level as `AuthContext`

### Mock data
Location: `my-app/src/demo/mockData.js`

Realistic fake data covering:
- ~20 lost/found listings across multiple campuses (Boston, London, Toronto, etc.)
- Map pins matching listing locations
- 3 fake conversations with pre-written message threads
- Fake user profile (name, campus, avatar)

### API interception
Location: `my-app/src/demo/demoApiLayer.js`

- In demo mode, all `apiFetch` and Supabase calls are intercepted
- Read operations return mock data
- Write operations (POST/PUT/DELETE) are blocked and show a toast: *"Demo mode — sign up to make changes"*

### Demo UI
- Persistent top banner: **"You're in Demo Mode"** with **"Sign Up"** CTA
- On web: links to registration
- On app (`Capacitor.isNativePlatform()`): slightly different wording per Apple guidelines — *"Explore the app — create a free account to get started"*
- `exitDemo()` clears demo state and returns to login screen

---

## Moderator Dashboard — Web Only

The `/moderation/*` routes must not appear in the native app.

**Implementation in `App.jsx`:**
```jsx
import { Capacitor } from '@capacitor/core';

// In the route definitions:
{!Capacitor.isNativePlatform() && (
  <Route path="/moderation/*" element={<DashboardPage />} />
)}
```

Any direct navigation attempt to `/moderation/*` on native falls through to the 404 page.

---

## Deep Linking (Auth Emails)

Supabase password reset and email confirmation links redirect to `https://thelostandhound.com`. Inside the app these would open Safari. Solution: register a custom URL scheme and intercept with `@capacitor/app`.

**Custom scheme:** `lostandhound://`

**`App.jsx` addition:**
```js
import { App as CapApp } from '@capacitor/app';

CapApp.addListener('appUrlOpen', (event) => {
  // e.g. lostandhound://reset-password?token=...
  const path = event.url.replace('lostandhound:/', '');
  navigate(path);
});
```

**Supabase config update:** Add `lostandhound://` as an allowed redirect URL in the Supabase dashboard.

---

## Deletion of `mobile/`

The entire `mobile/` directory is removed as part of this implementation. This includes:
- `mobile/app/` (Expo Router screens)
- `mobile/contexts/` (duplicate AuthContext, ThemeContext, etc.)
- `mobile/DEVELOPMENT-NOTES.md`
- `mobile/package.json` and `node_modules`

Root `package.json` workspace references to `mobile/` are removed.

---

## Verification

1. **Web build unchanged**: `npm run build` in `my-app/` produces a working dist
2. **Capacitor sync**: `npx cap sync` completes without errors
3. **iOS simulator**: `npx cap open ios` → build and run in simulator → all pages load, Maps renders, auth works
4. **Demo mode (web)**: Click "Try Demo" on login → all pages browsable, writes blocked with toast, banner visible
5. **Demo mode (app)**: Same flow in iOS simulator — banner wording adjusts for native
6. **Push notification**: Register device in dev → trigger a message → notification appears on lock screen
7. **Deep link**: Trigger a password reset email → tapping link opens app at `/reset-password`
8. **Moderator routes**: Log in as moderator in native app → `/moderation` redirects to 404
9. **Delete mobile/**: Confirm `git status` shows `mobile/` fully removed, no broken imports elsewhere
