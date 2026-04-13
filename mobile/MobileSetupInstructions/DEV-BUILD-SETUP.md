# Development Build Setup — Lost & Hound Mobile

Step-by-step instructions for building and running the mobile app locally. This is required for Google Maps, push notifications, and other native features that don't work in Expo Go.

---

## Prerequisites

### All Platforms
- Node.js 18+ (`node -v` to check)
- Git
- The `mobile/` project cloned with `npm install` completed

### iOS (Mac required)
- **Xcode** — install from the Mac App Store (free, ~12GB)
- **iOS Simulator Runtime** — must be downloaded separately after Xcode installs
- **CocoaPods** — installed automatically by Expo CLI

### Android
- **Android Studio** — download from https://developer.android.com/studio (free)
- During setup, make sure to install: Android SDK, Android SDK Platform-Tools, Android Virtual Device (AVD)

---

## First-Time iOS Setup

### 1. Install Xcode
Download from the Mac App Store. Open it once after install to accept the license.

### 2. Set Xcode Command Line Tools
```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### 3. Download iOS Simulator Runtime
Option A — from Xcode:
- Open Xcode → Settings (Cmd + ,) → Platforms → click "+" → iOS → Download

Option B — from terminal:
```bash
xcodebuild -downloadPlatform iOS
```
This is ~5GB and takes a while.

### 4. Verify Simulator Works
```bash
open -a Simulator
```
A simulator window should appear with an iPhone.

If `xcrun simctl list devices available` shows no devices, the runtime hasn't finished downloading yet.

### 5. Install CocoaPods (if not auto-installed)
```bash
sudo gem install cocoapods
```
Or let Expo handle it — it installs CocoaPods automatically on first build.

---

## First-Time Android Setup

### 1. Install Android Studio
Download and install from https://developer.android.com/studio

### 2. Set Environment Variables
Add to your `~/.zshrc` or `~/.bashrc`:
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```
Then run `source ~/.zshrc`.

### 3. Create an AVD (Android Virtual Device)
- Open Android Studio → Virtual Device Manager → Create Device
- Choose a Pixel device → Download a system image (API 34+) → Finish

### 4. Start the Emulator
```bash
emulator -avd Pixel_7_API_34
```
Or start it from Android Studio's Device Manager.

---

## Running the App

### Setup (first time only)
```bash
cd mobile
npm install
```

### Create your `.env` file
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```
Required values:
- `EXPO_PUBLIC_SUPABASE_URL` — same as `VITE_SUPABASE_URL` in the web app
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — same as `VITE_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_URL` — your local IP + backend port (e.g., `http://192.168.1.50:3001`)

**Important:** Use your local network IP, NOT `localhost`. Find it with:
```bash
ipconfig getifaddr en0
```

### Run on iOS Simulator
```bash
npx expo run:ios
```
First build takes 5-10 minutes. Subsequent builds are faster.

### Run on Android Emulator
```bash
npx expo run:android
```

### Run on Physical iPhone (plugged in via USB)
```bash
npx expo run:ios --device
```

### Run on Physical Android (plugged in via USB)
Enable USB debugging on the phone, then:
```bash
npx expo run:android --device
```

---

## Development Workflow

After the first build, you can use the Expo dev server for hot reload:
```bash
npx expo start --dev-client
```
This is faster than rebuilding every time — changes appear instantly.

**When to rebuild (full `npx expo run:ios`):**
- After adding a new native package (e.g., `npx expo install expo-camera`)
- After changing `app.json` (permissions, icons, plugins)
- After updating Expo SDK version

**When dev server is enough (`npx expo start --dev-client`):**
- All JS/TS code changes
- New screens, components, styles
- API logic changes

---

## Running the Backend

The mobile app needs the Express backend running. In a separate terminal:
```bash
cd my-app
node backend/server.js
```
This runs on port 3001 by default. Make sure your `.env` `EXPO_PUBLIC_API_URL` matches.

---

## Troubleshooting

### "No iOS devices available in Simulator.app"
The iOS simulator runtime isn't downloaded yet. Run:
```bash
xcodebuild -downloadPlatform iOS
```

### "CommandError: No development build"
You need to build first with `npx expo run:ios` before using `npx expo start --dev-client`.

### "Network request failed" on the app
- Backend not running — start it with `node backend/server.js`
- Wrong IP in `.env` — use your Mac's local IP, not localhost
- Restart Expo with `npx expo start -c` (clears cache)

### CocoaPods errors
```bash
cd ios && pod install && cd ..
```

### Build fails with signing errors
For simulator builds, no signing is needed. For device builds, you may need a free Apple ID:
- Open Xcode → Settings → Accounts → Add your Apple ID
- In the project, set Team to your Apple ID under Signing & Capabilities

---

## Key Files

| File | Purpose |
|------|---------|
| `app.json` | Expo config (app name, icons, API keys, plugins) |
| `.env` | Environment variables (Supabase URL, API URL) |
| `app/` | All screens (file-based routing) |
| `components/` | Reusable UI components |
| `contexts/` | Auth + Theme providers |
| `utils/` | API fetch, Supabase client, haptics, notifications |
| `constants/` | Theme colors, campus data, timezone |
| `DEVELOPMENT-NOTES.md` | React Native gotchas and patterns |
