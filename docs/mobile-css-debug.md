# Mobile CSS Debug — Page by Page
> Goal: screenshot every page on iOS simulator, fix layout issues, check off when clean.
> Pattern: screenshot → describe issues → fix → rebuild → confirm → check off.

---

## For Collaborators (Benjamin Hailu + Claude agent)

**Branch:** `live-demo-feature`

**How to test:**
1. `cd my-app && npm install`
2. `npm run build && npx cap sync`
3. Open Xcode: `npx cap open ios` — run on iPhone 16 simulator (Cmd+R)
4. Screenshot a page (Cmd+S in simulator), share with Claude, fix, rebuild, check off

**Key CSS rules for this codebase:**
- All safe area padding uses `env(safe-area-inset-top/bottom)` — e.g. `pt: "calc(Npx + env(safe-area-inset-top))"`
- `viewport-fit=cover` is already set in `index.html` so safe area vars are active
- MUI `sx` prop — use `{ xs: ..., md: ... }` breakpoints; xs = mobile, md = desktop
- Modals need `width: { xs: "calc(100% - 32px)", sm: "100%" }` to have side margins on mobile
- AppBar height is 64px; footer is 46px — content areas use `pb: "calc(46px + env(safe-area-inset-bottom))"`
- Do NOT commit directly — Ryan handles all git commits

**Rebuild after every change:**
```bash
cd my-app
npm run build && npx cap sync
# then Cmd+R in Xcode
```

---

## Core App Pages (main nav)

- [x] **Login page** — safe area top/bottom, edge-to-edge on mobile, logo clearance from Dynamic Island ✅ — **Ryan**
- [ ] **Feed page** (`/`) — listings, NewItemModal, NoteCard position — **Ryan**
- [ ] **Map page** (`/map`) — map fills screen, pins visible, NoteCard position — **Ryan**
- [ ] **Messages page** (`/messages`) — conversation list, chat view height, keyboard behavior — **Ryan**

---

## Auth Flow Pages

- [x] **Forgot Password** (`/forgot-password`) — **Ben**
- [x] **Reset Password** (`/reset-password`) — **Ben**

---

## Settings

- [x] **Settings page** (`/settings`) — campus/timezone pickers, exit demo section, safe area bottom — **Ben**

---

## Moderation / Dashboard (web-only — hidden on native, skip unless needed)

- [ ] **Dashboard Overview** (`/moderation`) — moderator only
- [ ] **Reports** (`/moderation/reports`)
- [ ] **Support** (`/moderation/support`)
- [ ] **Stats** (`/moderation/stats`)
- [ ] **Bugs** (`/moderation/bugs`)
- [ ] **Feedback** (`/moderation/feedback`)
- [ ] **Finances** (`/moderation/finances`)
- [ ] **My Work** (`/moderation/my-work`)

---

## Notes
- Moderation/dashboard pages are hidden on native (`Capacitor.isNativePlatform()`), so skip unless you want to check web layout.
- Rebuild command: `npm run build && npx cap sync` then Cmd+R in Xcode.
- Screenshot shortcut in simulator: Cmd+S (saves to Desktop).
