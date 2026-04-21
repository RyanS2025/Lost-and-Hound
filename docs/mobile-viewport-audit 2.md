# Mobile Keyboard & Viewport Audit

**Scope:** every file under `my-app/src/` (51 source files).
**Stance:** report-only. No changes have been made. Each recommendation is tagged with a platform-scope so a fix won't quietly degrade the desktop web build.

Legend:

- 🖥️ Desktop-safe — the fix applies universally; no desktop regression
- 📱 Mobile-only — the fix MUST be scoped so desktop doesn't see it
- ⚠️ Needs a decision — improves mobile but changes desktop behavior in a visible way
- 🔴 likely bug · 🟡 worth reviewing · 🟢 fine

---

## 0. Pre-audit: platform-detection patterns already in the codebase

Before recommending anything, here's what the codebase already uses. Fixes should follow these patterns rather than introduce a new one.

**Capacitor runtime check — 6 call sites**

- `src/pages/MessagePage.jsx:52` — `!Capacitor.isNativePlatform()` early-return from keyboard listener setup
- `src/hooks/usePushNotifications.js:11` — gate on native
- `src/App.jsx:702, 774` — hide moderator link & footer on native
- `src/components/LoadingScreen.jsx:28` — splash hide on native
- `src/components/AppFooter.jsx:50` — keyboard listeners on native, `visualViewport` fallback on web

Import shape used throughout: `import { Capacitor } from "@capacitor/core";`

**MUI useMediaQuery — 8 call sites, inconsistent breakpoints**

| File | Line | Query | Variable |
|---|---|---|---|
| `src/App.jsx` | 125 | `(max-width:1100px)` | `isCompactNav` |
| `src/pages/MapPage.jsx` | 197 | `(max-width:900px)` | `isMobile` |
| `src/pages/MessagePage.jsx` | 26 | `(max-width:900px)` | `isMobile` |
| `src/components/dashboard/TicketDetailModal.jsx` | 35 | `(max-width:960px)` | `isSmall` |
| `src/components/SupportModal.jsx` | 41 | `(max-width:780px)` | `isSmall` |
| `src/components/LoginSupportModal.jsx` | 79 | `(max-width:780px)` | `isSmall` |
| `src/pages/DashboardPage.jsx` | 14 | `(max-width:600px)` | `isMobile` |
| `src/pages/dashboard/ReportsPage.jsx` | 578 | `(max-width:600px)` | `isMobile` |

Import shape: `import useMediaQuery from "@mui/material/useMediaQuery";`

**Custom `useIsMobile` hook: does not exist.** There is no utility anywhere in `src/hooks/` or `src/utils/` that wraps platform detection. The only hook file is `src/hooks/usePushNotifications.js`.

**CSS `@media` queries: one, irrelevant.** `src/App.css:37` is `@media (prefers-reduced-motion: no-preference)`. There are zero `@media (max-width: ...)` rules in CSS — all responsive behavior is driven through MUI `sx={{ xs/sm/md: ... }}` or `useMediaQuery`.

**MUI default breakpoints** (used via `sx={{ xs: ..., md: ... }}`): xs=0, sm=600, md=900, lg=1200, xl=1536.

**Recommendation for any 📱 scoping in this report:** use MUI's 900 px breakpoint (`useMediaQuery("(max-width:900px)")`), since that's what `MessagePage` and `MapPage` — the pages most affected by keyboard/viewport bugs — already use. The 600/780/960/1100 breakpoints in other files are component-specific (layout breakpoints, not mobile/desktop splits). If the same mobile-only treatment is needed in multiple files, it's worth introducing a single `useIsMobile()` hook that wraps `useMediaQuery("(max-width:900px)")` so the breakpoint is defined in one place. For native-platform-only behavior, keep using `Capacitor.isNativePlatform()`.

**Capacitor config gotcha worth knowing:** `my-app/capacitor.config.ts` sets `Keyboard.resize: KeyboardResize.None`. That means on iOS/Android the webview does **not** resize when the keyboard opens — so `100dvh` on native behaves like `100vh` (the viewport never shrinks). This is why `MessagePage.jsx` manually subtracts `keyboardHeight` from `100dvh`, and why `AppFooter` has to listen for keyboard events to hide itself. A future decision to switch to `KeyboardResize.Native` would let `dvh` do the right thing automatically and would simplify several fixes below.

---

## 1. Legacy viewport units (`vh`, `100vh`, `window.innerHeight`)

**Count: 7 occurrences across 4 files.** Most of the codebase already migrated to `dvh`; these are stragglers.

| # | File:line | Description | Severity |
|---|---|---|---|
| 1 | `src/App.jsx:471` | `minHeight: "100vh"` on reset-password session-ready spinner wrapper | 🟡 |
| 2 | `src/App.jsx:505` | `minHeight: "100vh"` on awaiting-profile spinner wrapper | 🟡 |
| 3 | `src/pages/FeedPage.jsx:664` | `minHeight: "calc(100vh - 100px)"` on the Feed page outer Box | 🔴 |
| 4 | `src/pages/MapPage.jsx:716` | `height: { xs: "40vh", md: "calc(100vh - 240px)" }` on map container | 🔴 |
| 5 | `src/pages/MapPage.jsx:850` | `height: "calc(100vh - 240px)"` on Map side panel Paper | 🟡 |
| 6 | `src/components/ConfettiCanvas.jsx:38-39` | `canvas.width = window.innerWidth; canvas.height = window.innerHeight;` | 🟢 |
| 7 | `src/components/AppFooter.jsx:58` | `window.innerHeight - vv.height > 100` keyboard-height heuristic | 🟡 |

Also worth noting (non-viewport but mixes with the above): `src/App.css:137` — `.map-page { width: 100vw; }` and `:144` `.map-column { width: 50vw; }`. Widths are fine; viewport-width on mobile doesn't have the keyboard-resize problem. 🟢

**Recommendations:**

- **#1–#5 (vh/100vh/calc(100vh - X)):** swap to `dvh` / `calc(100dvh - X)`. 🖥️ Desktop-safe: on desktop the viewport never dynamically resizes, so `100dvh === 100vh`. Swap is literally the same visual outcome on desktop, and on mobile Safari/Chrome it accounts for the dynamic UA chrome. **Caveat on native:** because `capacitor.config.ts` sets `Keyboard.resize: None`, `dvh` won't shrink when the iOS keyboard opens — but `vh` doesn't either. This isn't worse than today; it matches the behavior of the already-`dvh` code in `index.css`, `App.css`, `LoginPage`, `SettingsPage`, etc. Consistency win.
- **#4 specifically** is the only one where `vh` mixes with a `dvh`-aware parent (`App.jsx:594` uses `calc(100dvh - 64px - safe-area...)`). That mismatch is what makes #4 🔴 — inside a dvh container there's a child measuring itself against `vh`. Swap to `dvh` here.
- **#6 Confetti canvas:** fine as-is. `window.innerHeight` gives the correct pixel dimension for canvas rendering, and confetti is a transient overlay — slight mismatch on keyboard-up doesn't matter. 🟢 No change.
- **#7 AppFooter keyboard heuristic:** this is the web fallback that tracks `visualViewport`. See Section 2 — recommendation is to guard this behind native vs. web but keep the heuristic for web browsers where iOS Safari's software keyboard also shrinks `visualViewport`. 📱 scope (web-mobile path only, no-op on desktop).

**All fixes 🖥️ desktop-safe** except #7 which is already platform-branched. There is no `@media` or `useMediaQuery` scoping needed for the `vh → dvh` swaps.

---

## 2. Orphaned `visualViewport` / manual keyboard tracking

**Count: 3 occurrences across 3 files.**

| # | File:line | Description | Severity |
|---|---|---|---|
| 1 | `src/components/AppFooter.jsx:49–77` | Manual keyboard detection via `visualViewport` web fallback; hides footer when keyboard open | 🟡 |
| 2 | `src/pages/MessagePage.jsx:48–75` | Capacitor `Keyboard.addListener` updates overlay height and auto-scrolls thread | 🟢 |
| 3 | `src/pages/MapPage.jsx:532–546` | `visualViewport.resize` listener that triggers Google Maps `resize` event to re-center | 🟡 |

**Recommendations:**

- **#1 (AppFooter):** The native branch is fine (`Capacitor.isNativePlatform()` gate at line 50). The web branch below it is the concern. On mobile Safari/Chrome-Android, `visualViewport.height < window.innerHeight` when the software keyboard is up, so the heuristic works. On desktop, `visualViewport.height ≈ window.innerHeight` unless the user pinch-zooms. The 100 px threshold makes a desktop false-positive unlikely but not impossible (devtools pane, zoom, etc.). **Recommendation:** add an explicit mobile-width gate (`window.matchMedia("(max-width:900px)").matches`) before the web fallback activates. 📱 scoped via the matching 900 px breakpoint used elsewhere. Zero risk on desktop.
- **#2 (MessagePage):** already correctly gated on `Capacitor.isNativePlatform()` at line 52. 🟢 No change.
- **#3 (MapPage):** this is a valid case — when the mobile URL bar shows/hides, `visualViewport` fires `resize` and the map needs to re-center. Not a bug. But it also fires on desktop during scroll/zoom, which is harmless (the Google Maps `resize` event is idempotent). 🟢 Leave as-is, or add a native-only branch for a microscopic perf gain — not worth it.

**AppFooter web fallback removal is not recommended** — it's the only thing preventing the footer from covering the input on mobile web (Safari without the app installed). Removing it would regress mobile web users. Keep it, but gate it by width.

---

## 3. Input font sizes (iOS 16 px focus-zoom risk)

**Count: 11 TextFields with explicit `fontSize: 13`; plus ~186 other TextFields using MUI defaults.**

iOS zooms into any `<input>` or `<textarea>` whose computed `font-size < 16px` on focus. MUI's default `TextField` uses `1rem = 16px`, so untouched TextFields are safe. The ones that explicitly set `fontSize: 13` are at risk on iOS.

| # | File:line | Component | Current fontSize |
|---|---|---|---|
| 1 | `src/components/dashboard/TicketDetailModal.jsx:247` | moderator search Autocomplete | 13 |
| 2 | `src/components/dashboard/TicketDetailModal.jsx:253` | date TextField | 13 |
| 3 | `src/components/dashboard/TicketDetailModal.jsx:294` | reason TextField | 13 |
| 4 | `src/components/dashboard/TicketDetailModal.jsx:299` | notes TextField | 13 |
| 5 | `src/components/dashboard/TicketDetailModal.jsx:304` | duration TextField | 13 |
| 6 | `src/components/dashboard/TicketDetailModal.jsx:409` | reply TextField | 13 |
| 7 | `src/components/dashboard/TicketDetailModal.jsx:473` | support reply TextField | 13 |
| 8 | `src/components/SupportModal.jsx:447` | chat reply | 13 |
| 9 | `src/components/SupportModal.jsx:579` | support reply | 13 |
| 10 | `src/components/LoginSupportModal.jsx:589` | chat reply | 13 |
| 11 | `src/components/LoginSupportModal.jsx:892` | support reply | 13 |

Severity: 🟡 for TicketDetailModal items (moderator-only dashboard — rarely used on mobile), 🔴 for SupportModal and LoginSupportModal items (regular users on mobile web hit these).

Also observed: `src/pages/dashboard/BugsPage.jsx:75` `<InputLabel sx={{ fontSize: 12 }}>` — affects label only, not input focus, so no zoom risk. 🟢

**Recommendation (all 📱):**

Bump to `fontSize: 16` *only on mobile*. The stated desktop visual density (13 px inputs in dashboards) needs to be preserved. Use an sx responsive object keyed on MUI's `xs`/`md` breakpoints:

```jsx
sx={{ "& .MuiOutlinedInput-root": {
  borderRadius: 1.5,
  fontSize: { xs: 16, md: 13 },  // Mobile: 16 prevents iOS focus-zoom. Desktop: 13 for density.
} }}
```

This uses MUI's breakpoint system, which aligns with the `md` breakpoint (900 px) already used by `MessagePage`/`MapPage`'s `useMediaQuery`. 📱 — applied to mobile only, no impact on desktop rendering.

Alternatively, for places where the value is used repeatedly (SupportModal, LoginSupportModal, TicketDetailModal all share this pattern), introduce a shared constant like `INPUT_FONT_SIZE = { xs: 16, md: 13 }` in `dashboardConstants.js` or a new `src/utils/responsive.js`. That avoids drift.

**Do not apply a blanket 16 px to every input globally** — it would make desktop dashboards look chunky, which contradicts the explicit density tuning the team did. This is exactly the case Raj flagged.

---

## 4. Fixed positioning near inputs

**Count: 12 occurrences.** Most are decorative backgrounds or overlays that don't interact with keyboard. A few are layout-critical.

| # | File:line | What's fixed | Near an input? | Severity |
|---|---|---|---|---|
| 1 | `src/App.jsx:584` | Dotted background `inset: 0, zIndex: -1` | No | 🟢 |
| 2 | `src/App.jsx:552, 645` | `<AppBar position="fixed">` with `pt: safe-area-inset-top` | Not directly | 🟢 |
| 3 | `src/components/AppFooter.jsx:84` | Fixed footer bottom:0 | Yes — sits above inputs | 🟡 |
| 4 | `src/pages/MessagePage.jsx:508` | Dotted background | No | 🟢 |
| 5 | `src/pages/MessagePage.jsx:560` | Mobile thread overlay `position: fixed, inset: 0, height: 100dvh` | Yes — contains TextField at bottom | 🟡 |
| 6 | `src/pages/SettingsPage.jsx:254` | Dotted background | No | 🟢 |
| 7 | `src/pages/MapPage.jsx:558` | Dotted background | No | 🟢 |
| 8 | `src/pages/NotFoundPage.jsx:12` | Dotted background | No | 🟢 |
| 9 | `src/components/LoadingScreen.jsx:40` | Full-screen loader | No | 🟢 |
| 10 | `src/components/NoteCard.jsx:31–35` | Fixed demo note, bottom: `calc(64px + safe-area-inset-bottom)`, zIndex 1300 | Could overlap inputs | 🟢 |
| 11 | `src/components/ItemDetailModal.jsx:85` | Lightbox overlay inset:0 | No | 🟢 |
| 12 | `src/components/ConfettiCanvas.jsx:75` | Fixed confetti canvas | No | 🟢 |

**Recommendations:**

- **#3 AppFooter:** the component already hides itself (`if (keyboardOpen) return null;` at line 77) when the native keyboard fires or when the web `visualViewport` heuristic trips. On **desktop there is no keyboard** — `Capacitor.isNativePlatform()` is false AND `visualViewport` is stable — so the footer should never hide. This is correct *by construction*, but fragile: if somebody accidentally causes a `visualViewport` resize event on desktop (rare but possible with dev tools or pinch-zoom), the footer would vanish. **Recommendation:** add a `useMediaQuery("(max-width:900px)")` guard so `keyboardOpen` can only become `true` on narrow viewports. 📱 scoped. No visible change on desktop; hardening against the edge case.
- **#5 MessagePage mobile thread:** the `overlayRef` imperative style swap to `calc(100dvh - ${keyboardHeight}px)` at line 56 is already gated on `Capacitor.isNativePlatform()`. 🟢 correctly scoped.
- **#10 NoteCard:** uses `env(safe-area-inset-bottom)`. On desktop these resolve to 0, so the note sits at `bottom: 64px` / `sm: 70px`. Fine. 🟢.

All other fixed-positioning usages are background overlays or global chrome and carry no keyboard-interaction risk.

---

## 5. Safe-area handling (`env(safe-area-inset-*)`)

**Count: 17 occurrences across 9 files.** All well-placed.

Representative samples:

- `src/App.jsx:552, 645` — `AppBar pt: "env(safe-area-inset-top)"` (Dynamic Island/notch clearance)
- `src/App.jsx:581, 743` — spacer matches AppBar height + safe-area-inset-top
- `src/App.jsx:594, 757` — content height subtracts top + bottom safe-area insets
- `src/pages/MessagePage.jsx:512` — desktop split-panel height calc with safe-area
- `src/pages/MessagePage.jsx:578` — mobile thread header `pt: "calc(env(safe-area-inset-top) + 8px)"`
- `src/pages/MessagePage.jsx:610` — `pb: keyboardOpen ? 0 : "env(safe-area-inset-bottom)"`
- `src/pages/LoginPage.jsx:582, 708` — form padding with safe-area
- `src/pages/ForgotPasswordPage.jsx:105–106`, `src/pages/ResetPasswordPage.jsx:136–137`
- `src/components/TermsModal.jsx:151–152` — dialog `mt` + `maxHeight` include safe-area
- `src/components/AppFooter.jsx:91` — footer `pb: "env(safe-area-inset-bottom)"`
- `src/components/NoteCard.jsx:33` — note bottom position

**Severity: 🟢 across the board.** `env(safe-area-inset-*)` resolves to `0` on desktop browsers (including Firefox/Chrome/Edge which don't implement it at all; MUI/CSS just treats missing env values as 0). There's nothing to scope.

**Recommendation:** no changes needed in this category. 🖥️ Current pattern is universally safe.

One minor observation: `src/components/TermsModal.jsx:151` mixes `vh` with `env(safe-area-inset-top)` in a maxHeight calc (`calc(88vh - env(safe-area-inset-top))`). If recommendation #1 from Section 1 gets applied codebase-wide, this one should be swapped to `88dvh` too for consistency. 🖥️ safe.

---

## 6. Scroll containers

**Count: 16 scroll containers. 2 with `vh` maxHeight, 2 with `WebkitOverflowScrolling`.**

`vh`-based fixed heights:

| # | File:line | Value | Severity |
|---|---|---|---|
| 1 | `src/pages/dashboard/ReportsPage.jsx:56` | `maxHeight: "90vh"` on moderator modal | 🟡 |
| 2 | `src/pages/dashboard/ReportsPage.jsx:228` | `maxHeight: 320` (px, not vh) | 🟢 |

Already-`dvh` scroll containers (good): `src/pages/FeedPage.jsx:364`, `src/components/ItemDetailModal.jsx:54`, `src/components/ItemDetailModal.jsx:86` all use `90dvh`.

`-webkit-overflow-scrolling` usages:

| # | File:line | Context |
|---|---|---|
| 1 | `src/pages/MapPage.jsx:580` | `WebkitOverflowScrolling: "touch"` on a horizontal chip strip |
| 2 | `src/components/TermsModal.jsx:193` | `WebkitOverflowScrolling: "touch"` on Terms scroll area |

Other scroll containers use `overflowY: "auto"` with `flex: 1` and `minHeight: 0` — correctly decoupled from viewport height.

**Recommendations:**

- **#1 ReportsPage modal:** swap `90vh` → `90dvh` to match other modals. 🖥️ Desktop-safe. 🟡 worth doing for consistency.
- **WebkitOverflowScrolling: "touch"** — legacy iOS momentum-scroll hint. On iOS ≥13 this is default behavior and the property is ignored. On desktop it's ignored. 🖥️ safe to leave or remove. I'd leave it; harmless.
- `src/components/TermsModal.jsx:192` uses `overflowY: "scroll"` (not `auto`). Combined with the `maxHeight: "calc(88vh - env(safe-area-inset-top))"` → `88dvh` swap from Section 5, this scroll container would behave correctly on both platforms. 🖥️ safe.

---

## 7. Focus handlers and `scrollIntoView`

**Count: 3 `scrollIntoView` call sites, 3 `autoFocus` props.**

| # | File:line | What it does | Mobile-specific? |
|---|---|---|---|
| 1 | `src/components/LoginSupportModal.jsx:162` | `setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50)` after replies load | No |
| 2 | `src/components/SupportModal.jsx:151` | `chatBottomRef.current?.scrollIntoView()` on open | No |
| 3 | `src/components/SupportModal.jsx:159` | `scrollIntoView({ behavior: "smooth" })` on new reply | No |
| 4 | `src/components/dashboard/TicketDetailModal.jsx:71` | same | No |
| 5 | `src/pages/LoginPage.jsx:829` | `autoFocus` on MFA code input | No |
| 6 | `src/pages/ForgotPasswordPage.jsx:173` | `autoFocus` on email input | No |
| 7 | `src/pages/ResetPasswordPage.jsx:206` | `autoFocus` on password input | No |

**Recommendations:**

- **scrollIntoView calls** are all scroll-to-bottom-of-chat behaviors, not keyboard workarounds. They work identically on desktop and mobile. 🟢 No change. 🖥️ Current implementation is fine.
- **autoFocus on mobile has an iOS quirk:** iOS Safari refuses `autofocus` outside of a user-gesture event, so in practice the MFA/email/password fields will *not* auto-focus on iOS Safari (they do on desktop and on Capacitor WKWebView sometimes). This is not a bug — it's browser policy. No change needed. 🟢
- There is **no `onFocus={...scrollIntoView(...)}`** pattern in the codebase (the "iOS keyboard obscures input" manual workaround). That's good — its absence is why the iOS keyboard currently hides the MessagePage input on native, which is the bug `MessagePage`'s `keyboardWillShow` listener was built to solve. If the recommended fix elsewhere is to rely on `KeyboardResize.Native`, this category stays empty.

---

## 8. MUI Dialog / Drawer / Modal / AppBar

**Count: 82 Dialog/Drawer/Modal usages across 18 files, plus 2 `<AppBar position="fixed">`.**

Most Dialogs use MUI defaults and work identically on desktop and mobile. A few have custom `PaperProps` that set heights or safe-area padding:

| # | File:line | Customization | Platform concern? |
|---|---|---|---|
| 1 | `src/components/TermsModal.jsx:144–154` | `PaperProps maxHeight: "calc(88vh - env(safe-area-inset-top))"`, `mt: "env(safe-area-inset-top)"` | `vh` on dvh-aware codebase; `env()` zero on desktop |
| 2 | `src/components/AppFooter.jsx:164–176` | Info Dialog, default MUI | None |
| 3 | `src/pages/FeedPage.jsx:360–364` | Modal with `maxHeight: "90dvh"` | 🟢 already dvh |
| 4 | `src/components/ItemDetailModal.jsx:54` | Modal with `maxHeight: "90dvh"` | 🟢 already dvh |
| 5 | `src/pages/dashboard/ReportsPage.jsx:52–60` | Modal with `maxHeight: "90vh"` | 🟡 stale vh, see Section 6 |
| 6 | `src/App.jsx:552, 645` | `<AppBar position="fixed" pt: env(safe-area-inset-top)>` | 🟢 safe-area is a no-op on desktop |
| 7 | Dialogs in `BugsPage`, `FeedbackPage`, `SupportPage`, `MyWorkPage`, `FinancesPage`, `ReportsPage`, `SettingsPage` | Plain MUI, no custom height/keyboard logic | 🟢 |

**Recommendations:**

- **#1 TermsModal:** `88vh → 88dvh` recommended already (Section 5). 🖥️ desktop-safe swap.
- **#5 ReportsPage modal:** `90vh → 90dvh`. 🖥️ desktop-safe.
- **AppBar (#6):** no changes. The `pt: "env(safe-area-inset-top)"` is desktop-safe because the env value is 0 on desktop.
- **Drawer** — there are zero `<Drawer>` usages in the codebase. Not a concern.
- **No PaperProps/sx changes are needed that would tweak desktop look.** If in a future session Raj wants a Dialog that *does* change position on mobile (e.g., bottom-sheet style), that fix would be ⚠️ because it would alter desktop layout too — but right now nothing in the code requires that.

---

## 9. `100%` height chains

**Count: ~10 elements using `height: "100%"`.** The parent chain needs to bottom out in something that defines a pixel (or `dvh`) height, otherwise `height: 100%` collapses to `0`.

Traced parent chains (verified from the files):

- `index.css:9–11` — `html, body { height: 100dvh; }` ✅ root chain is `dvh`-based
- `src/pages/MessagePage.jsx:516, 569` — inside a `height: "calc(100dvh - ...)"` container → ✅ chain OK
- `src/pages/dashboard/DashboardOverviewPage.jsx:59` — card `height: "100%"` inside a grid; parent uses `display: flex, flex: 1` → ✅ fine
- `src/pages/dashboard/StatsPage.jsx:80` — `height: "100%"` on a progress bar inner — parent has a pixel height → ✅ fine
- `src/pages/FeedPage.jsx:157`, `src/pages/MapPage.jsx:149` — `<img style={{ height: "100%" }}>` inside a parent with fixed pixel size → ✅ fine
- `src/components/LoginSupportModal.jsx:850`, `src/components/dashboard/TicketDetailModal.jsx:439`, `src/components/SupportModal.jsx:524` — chat panel `height: "100%"` inside a Dialog/Modal with `maxHeight: "88dvh"` (via PaperProps) → ✅ OK on dvh chain

**No broken height chains found.** All `height: "100%"` usages eventually resolve through a `dvh`-based ancestor. 🟢 No changes recommended. 🖥️ / 📱 not applicable.

---

## 10. Touch / tap targets

**Count: many (58 `size="small"` IconButton/Button usages; plus numerous plain `<Button>` elements).**

A MUI `IconButton` default is 40 × 40 px. `IconButton size="small"` is 34 × 34 px. iOS HIG recommends 44 × 44 px; Material Design 3 recommends 48 × 48 px. Apple doesn't enforce this but it affects usability.

No current code violates a keyboard-obstruction risk (which is the category `🖥️` vs `📱` question for this report). The small-size buttons are purely aesthetic density — identical behavior on desktop and mobile.

**Specific callouts:**

- `src/components/NoteCard.jsx:49` — `<IconButton size="small">` on a demo-note close button. Hard-to-tap on mobile. 🟡 if Raj cares; 🟢 for this audit's purpose (not keyboard-related).
- `src/pages/MessagePage.jsx:497` — `<IconButton size="small">` delete button on conversation list. Fine.
- `src/components/ReportModal.jsx`, `SupportModal.jsx`, `LoginSupportModal.jsx`, `TicketDetailModal.jsx` — all use `size="small"` for close buttons in dialog headers. Standard MUI pattern.

**Recommendation:** **no changes required for the keyboard/viewport audit.** Any tap-target bump is 📱 (would visibly change desktop button density) and belongs in a separate UX pass, not this one. If Raj wants a tap-target pass later, I'd scope it 📱 via `useMediaQuery("(max-width:900px)")` and apply it to the dashboard-density buttons only.

---

## Summary

| Category | 🔴 | 🟡 | 🟢 | Recommended fixes |
|---|---|---|---|---|
| 1. Viewport units | 2 | 4 | 1 | 5 files to swap `vh` → `dvh` (🖥️ safe) |
| 2. visualViewport / keyboard tracking | 0 | 2 | 1 | 1 📱 scoping on AppFooter web fallback |
| 3. Input font sizes | 4 | 7 | 0 | 11 inputs bumped 13 → `{ xs: 16, md: 13 }` (📱 scoped) |
| 4. Fixed positioning | 0 | 2 | 10 | 1 📱 hardening on AppFooter; MessagePage already correct |
| 5. Safe-area | 0 | 0 | 17 | None (+1 cosmetic swap if doing Section 1) |
| 6. Scroll containers | 0 | 1 | 15 | 1 `90vh → 90dvh` (🖥️ safe) |
| 7. Focus / scrollIntoView | 0 | 0 | 7 | None |
| 8. MUI Dialog/Drawer/Modal/AppBar | 0 | 2 | 80+ | 2 `vh → dvh` swaps covered by #1/#6 |
| 9. `100%` height chains | 0 | 0 | 10 | None — all chains resolve through a `dvh` root |
| 10. Touch targets | 0 | 1 | — | Out of scope for this audit |

### The short list of what to actually change

Ordered by impact:

1. **Input font-sizes (📱).** Swap `fontSize: 13` → `fontSize: { xs: 16, md: 13 }` in the 11 TextFields listed in Section 3. Biggest UX win on iOS mobile web: prevents the annoying focus-zoom, preserves dashboard density on desktop.
2. **`vh` → `dvh` swaps (🖥️).** Five call sites across `App.jsx`, `FeedPage.jsx`, `MapPage.jsx`, `ReportsPage.jsx`, `TermsModal.jsx`. Pure consistency win — desktop behaves identically.
3. **AppFooter web fallback width guard (📱).** Add `useMediaQuery("(max-width:900px)")` around the `visualViewport` web-branch listener so a desktop pinch-zoom or devtools-resize can't cause the footer to hide.
4. **Nothing else is required.** Sections 5, 7, 9 are already correct. Section 10 is outside the audit's keyboard/viewport scope.

### Scoping mechanism (reminder from the pre-audit)

For any 📱 fix use:

- **Narrow width check (most cases):** `useMediaQuery("(max-width:900px)")` — matches the breakpoint used by `MessagePage.jsx:26` and `MapPage.jsx:197`. Or for `sx`-local scoping: `sx={{ ..., [breakpoint]: { ... } }}` with MUI's `xs`/`md` keys (md = 900 px).
- **Native-only check:** `Capacitor.isNativePlatform()` — matches the existing 6 call sites. Import: `import { Capacitor } from "@capacitor/core";`
- **Do not introduce a new breakpoint value** (e.g., 768 or 768 px) — it'd be the 6th different one in this codebase and would make future "what's mobile?" answers even harder. Long-term, this codebase would benefit from a single `useIsMobile()` hook (living in `src/hooks/`) that wraps the 900 px media query, so the breakpoint is defined once.

### Why this is the right shape for this codebase

Raj's constraint — "both a desktop website AND a Capacitor mobile app from the same CSS and components" — means the highest risk is a fix that improves mobile while silently making the desktop site look or behave worse. That's what happened with the earlier suggested 16 px universal input bump. This audit deliberately avoids those traps:

- Every `vh → dvh` swap is 🖥️ because `dvh === vh` on a non-resizing viewport (desktop's).
- Every `env(safe-area-*)` keep is 🖥️ because the env value is `0` on desktop browsers.
- Every input-font-size bump is 📱 scoped because desktop genuinely prefers 13–14 px inputs for dashboard density.
- The `visualViewport` web fallback in AppFooter stays — removing it would regress mobile web users — but it gets a width gate so desktop can never trip it.

No 📱 change in this report touches the desktop visual output. No 🖥️ change in this report risks making desktop worse than it is today.

Awaiting your approval on which of the "short list" items to apply, and confirmation that `useMediaQuery("(max-width:900px)")` / the MUI `{ xs, md }` breakpoint pattern is the scoping mechanism you want me to use.
