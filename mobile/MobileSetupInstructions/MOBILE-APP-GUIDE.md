# Mobile App Guide — Lost & Hound

Everything the team needs to know before porting Lost & Hound to iOS and Android.

---

## 1. Overview & Approach

We're using **React Native with Expo** to build native iOS and Android apps. This means:

- **New frontend, same backend** — `server.js` and Supabase stay exactly as-is
- **Truly native UI** — real native components, not a website in a shell
- **Your React knowledge transfers** — same hooks, state, patterns — just different components (`View` instead of `div`, `Text` instead of `span`)
- **Expo handles the hard parts** — builds, signing, OTA updates, push notifications without touching Xcode/Android Studio directly
- **Separate directory** — a new `mobile/` folder in the same repo

### What stays the same

- Backend (`server.js`) — zero changes
- Supabase (auth, database, realtime) — zero changes
- API endpoints — the mobile app calls the same `/api/*` routes
- Business logic (auth flow, MFA, messaging) — same flow, different UI

### What gets rewritten

- UI components — MUI `<Box>`, `<Paper>`, `<Typography>` become React Native `<View>`, `<Text>`, `<StyleSheet>`
- Navigation — React Router becomes React Navigation (stack, tabs)
- Styling — MUI `sx` props become React Native `StyleSheet.create()`
- Storage — `localStorage` becomes `AsyncStorage` or `expo-secure-store`

---

## 2. Costs & Accounts

| Item | Cost | Notes |
|------|------|-------|
| Google Play Developer | $25 one-time | Required to publish on Google Play |
| Apple Developer Program | $99/year | Required to publish on App Store |
| Firebase (push notifications) | Free | FCM free tier covers push |
| Expo EAS Build | Free tier: 30 builds/month | Enough for development; paid plans for teams |
| Expo EAS Update (OTA) | Free tier available | Push JS updates without app store review |

**Total minimum to launch on both platforms: $124**

**Tip:** Check if Oasis or NEU's CS department has an existing Apple/Google developer account you can publish under. Many universities do.

### Who holds the accounts?

Decide now who owns the developer accounts. Options:
- **A team member's personal account** — simplest but tied to one person
- **An Oasis organization account** — better for continuity across semesters
- **A shared team email** — create a dedicated email (e.g., lostandhound.app@gmail.com)

---

## 3. Technical Setup (React Native + Expo)

### Prerequisites

- Node.js 18+ (you already have this)
- **For iOS testing:** macOS + Xcode (free from Mac App Store)
- **For Android testing:** Android Studio (free) or just the Expo Go app on a physical device
- **Expo Go app** on your phone (free) — lets you run the app during development without building
- At least one team member needs a Mac for iOS builds

### Installation

```bash
# From the repo root
npx create-expo-app mobile --template blank-typescript
cd mobile

# Install key dependencies
npx expo install expo-router expo-notifications expo-secure-store
npx expo install @react-navigation/native @react-navigation/bottom-tabs
npx expo install react-native-safe-area-context react-native-screens
npm install @supabase/supabase-js
```

### Development Workflow

```bash
cd mobile

# Start development server
npx expo start

# Then:
# - Press 'i' for iOS simulator
# - Press 'a' for Android emulator
# - Scan QR code with Expo Go on your phone for real device testing
```

No `npm run build` → `cap sync` cycle. Changes appear instantly via hot reload.

### Project Structure

```
s26-group-1/
├── my-app/                    # Web app (unchanged)
│   ├── src/
│   ├── backend/               # Shared backend
│   └── package.json
├── mobile/                    # NEW — React Native app
│   ├── app/                   # Screens (file-based routing via expo-router)
│   │   ├── (tabs)/            # Tab navigation
│   │   │   ├── feed.tsx       # Feed screen
│   │   │   ├── map.tsx        # Map screen
│   │   │   └── messages.tsx   # Messages screen
│   │   ├── login.tsx          # Login screen
│   │   └── settings.tsx       # Settings screen
│   ├── components/            # Shared components
│   ├── utils/                 # API fetch, auth helpers (port from web)
│   ├── app.json               # Expo config
│   └── package.json
├── MOBILE-APP-GUIDE.md
└── README.md
```

### What to port from the web app

These files can be reused with minimal changes:

| Web file | Mobile equivalent | Changes needed |
|----------|-------------------|----------------|
| `utils/apiFetch.js` | `utils/apiFetch.ts` | Swap localStorage for SecureStore |
| `AuthContext.jsx` | `contexts/AuthContext.tsx` | Same logic, swap storage |
| `utils/timezone.js` | `utils/timezone.ts` | Copy as-is |
| `constants/campuses.js` | `constants/campuses.ts` | Copy as-is |

### Key Config (app.json)

```json
{
  "expo": {
    "name": "Lost & Hound",
    "slug": "lost-and-hound",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#A84D48"
    },
    "ios": {
      "bundleIdentifier": "com.lostandhound.app",
      "supportsTablet": false
    },
    "android": {
      "package": "com.lostandhound.app",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#A84D48"
      }
    },
    "plugins": [
      "expo-router",
      "expo-notifications",
      "expo-secure-store"
    ]
  }
}
```

---

## 4. Push Notifications

### Architecture

```
Your Backend (server.js)
    │
    ▼
Expo Push Notification Service (free)
    │
    ├──► FCM ──► Android device
    └──► APNs ──► iOS device
```

Expo's push service wraps FCM and APNs into a single API. You don't need to configure Firebase directly.

### Setup Steps

1. **Install expo-notifications** (already included above)
2. **Register for push tokens** in the mobile app on startup:
   ```typescript
   import * as Notifications from 'expo-notifications';
   const token = (await Notifications.getExpoPushTokenAsync()).data;
   // Send token to your backend
   ```
3. **Store tokens in Supabase** — new `device_tokens` table
4. **Send from your backend** — simple HTTP POST to Expo's push API:
   ```javascript
   await fetch('https://exp.host/--/api/v2/push/send', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       to: expoPushToken,
       title: 'New Message',
       body: 'Benjamin: Hey, is this your jacket?',
     }),
   });
   ```

No Firebase project setup needed. No APNs certificates to manage. Expo handles it all.

### When to Send Notifications

| Event | Notification |
|-------|-------------|
| New message received | "Benjamin: Hey, is this your jacket?" |
| Your post gets a response | "Someone responded to: Black North Face Jacket" |
| New item posted near you | "New lost item near Stearns Center: AirPods Pro Case" |
| Post marked as resolved | "Your listing 'Husky Card' was marked as returned" |

### Backend Changes Needed

- New table: `device_tokens` (user_id, token, platform, created_at)
- New endpoint: `POST /api/device-tokens` — register/update push token
- New utility: `sendPushNotification(userId, title, body)` — looks up tokens and calls Expo push API
- Add notification triggers to existing endpoints (message send, listing create, etc.)

---

## 5. Over-the-Air Updates (Skip App Store Reviews)

### EAS Update (built into Expo)

No third-party service needed. Expo has this built in.

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure updates
eas update:configure

# Push an update (no app store review)
eas update --branch production --message "Fixed feed sorting bug"
```

### How It Works

1. You push code to GitHub as normal
2. Run `eas update` to push the JS bundle to Expo's CDN
3. Next time users open the app, it downloads the update in the background
4. On next app launch, the new version loads

### What Can Be OTA Updated (No Review)

- All React Native components, screens, styles
- Bug fixes, new features, UI changes
- Navigation changes
- API logic changes (backend deploys separately anyway)

### What Still Needs an App Store Update

- Adding new native modules (camera, biometrics, etc.)
- Changing app.json config (permissions, icons, splash)
- Expo SDK version upgrades
- Changes that require a new native build

**In practice, 90-95% of updates ship instantly without app review.**

---

## 6. Build & Submission Process

### Using EAS Build (Recommended)

Expo builds the native binaries in the cloud. No local Xcode/Android Studio needed for production builds.

```bash
# First time: link to your Apple/Google accounts
eas credentials

# Build for both platforms
eas build --platform ios
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

### Manual Builds (Alternative)

If you prefer local builds:

**Android:**
1. `npx expo run:android --variant release`
2. Upload `.aab` to Google Play Console

**iOS:**
1. `npx expo run:ios --configuration Release`
2. Archive in Xcode → Upload to App Store Connect

### Required Assets for Store Listings

- **App icon:** 1024x1024 PNG (no transparency for iOS)
- **Screenshots:** iPhone 6.7" + Android phone sizes minimum
- **Description:** Short (80 chars) + full description
- **Privacy policy URL:** thelostandhound.com (already have this)
- **Category:** Utilities or Lifestyle
- **Age rating:** 4+ (no objectionable content)

---

## 7. Ongoing Maintenance

| Task | Frequency |
|------|-----------|
| Monitor crash reports (Expo/Sentry) | Weekly |
| Respond to app store reviews | As they come in |
| Update Expo SDK | Every few months |
| Renew Apple Developer membership | Yearly ($99) |
| Test on new OS versions (iOS/Android betas) | Annually (summer) |
| Push OTA updates for bug fixes | As needed |

### When iOS/Android Release New OS Versions

- Test the app on the beta OS (usually June-September)
- Update Expo SDK if needed
- Submit a compatibility update before the OS launches publicly

---

## 8. Timeline Estimate

Assuming one developer working part-time with Claude assistance:

| Phase | Duration |
|-------|----------|
| Expo project setup + navigation | 1-2 days |
| Auth flow (login, signup, MFA) | 2-3 days |
| Feed screen | 1-2 days |
| Map screen | 2-3 days |
| Messages screen | 2-3 days |
| Settings screen | 1 day |
| Push notifications (backend + mobile) | 2-3 days |
| Testing on real devices | 2-3 days |
| Store listing prep (screenshots, descriptions) | 1 day |
| Submission + review | 1-3 days |
| **Total** | **~3-4 weeks** |

---

## 9. Checklist Before Starting

- [ ] Decide who holds the Apple/Google developer accounts
- [ ] Check if Oasis/NEU has existing developer accounts
- [ ] Ensure at least one team member has a Mac (required for iOS builds)
- [ ] Install Xcode (iOS) and/or Android Studio (Android)
- [ ] Install Expo Go on your phone for testing
- [ ] Decide on a bundle ID (e.g., `com.lostandhound.app`) — this is permanent
- [ ] Prepare a 1024x1024 app icon
- [ ] Create splash screen asset (branded loading screen)
- [ ] Set up EAS account (`npx eas-cli login`)

---

## 10. Component Translation Cheat Sheet

Quick reference for converting web components to React Native:

| Web (MUI) | React Native |
|-----------|-------------|
| `<Box>` | `<View>` |
| `<Typography>` | `<Text>` |
| `<Paper>` | `<View style={styles.card}>` |
| `<TextField>` | `<TextInput>` |
| `<Button>` | `<TouchableOpacity>` or `<Pressable>` |
| `<IconButton>` | `<Pressable>` + icon |
| `<CircularProgress>` | `<ActivityIndicator>` |
| `<Dialog>` / `<Modal>` | `<Modal>` (built-in) |
| `sx={{ p: 2, mt: 3 }}` | `style={{ padding: 16, marginTop: 24 }}` |
| `useMediaQuery` | `useWindowDimensions()` |
| MUI dark/light theme | React Native `useColorScheme()` + custom theme |
| React Router `<Link>` | Expo Router `<Link>` or `router.push()` |
| `localStorage` | `expo-secure-store` |
| Google Maps JS API | `react-native-maps` |
| CSS `overflowY: auto` | `<ScrollView>` or `<FlatList>` |

---

## Quick Reference Commands

```bash
# First-time setup
npx create-expo-app mobile --template blank-typescript
cd mobile
npx expo install expo-router expo-notifications expo-secure-store

# Daily development
npx expo start
# Press 'i' for iOS, 'a' for Android, or scan QR with Expo Go

# Build for stores
eas build --platform all

# Submit to stores
eas submit --platform all

# Push OTA update (no app review)
eas update --branch production --message "description of changes"
```
