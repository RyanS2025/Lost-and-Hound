# Claude Code Prompt — Mobile Keyboard & Viewport Fixes

Copy everything below the `---` into Claude Code. It is self-contained: it tells Claude Code what the repo looks like, the exact file/line edits to make, the scoping rules, and the verification steps it must run before declaring itself done.

---

You are going to apply a small set of mobile keyboard and viewport fixes to this repository. This codebase serves BOTH a desktop website AND a Capacitor iOS/Android app from the same React + MUI source in `my-app/src/`. A previous audit already identified exactly which fixes to make and how to scope them so the desktop experience is not degraded. **Your job is to execute those fixes faithfully and verify the app still builds and runs.**

Full audit report (read this first for context): `docs/mobile-viewport-audit.md`.

## Ground rules — read before editing

1. **Do not invent new breakpoints.** Use `useMediaQuery("(max-width:900px)")` when you need a JS-side mobile gate, or MUI's `{ xs: ..., md: ... }` `sx` responsive object for style-side gating. `md` in MUI's default theme is 900 px, which matches the existing mobile split in `src/pages/MessagePage.jsx:26` and `src/pages/MapPage.jsx:197`.
2. **Do not introduce a new `useIsMobile` hook in this PR.** Stay with `useMediaQuery` from `@mui/material/useMediaQuery` (already imported in several files). A future refactor can consolidate the breakpoint; this PR is deliberately minimal.
3. **Do not add or remove dependencies.** Everything needed is already in `my-app/package.json`.
4. **Do not "clean up" adjacent code** unless it's literally on the same line as the fix. No drive-by refactors.
5. **`dvh === vh` on desktop** (the viewport never dynamically resizes on desktop browsers), so `vh → dvh` swaps are desktop-safe. Do not wrap them in any media query or platform check.
6. **`env(safe-area-inset-*)` resolves to `0` on desktop browsers.** Do not wrap those either.
7. **On Capacitor native, `capacitor.config.ts` has `Keyboard.resize: KeyboardResize.None`.** That means `dvh` on native does NOT shrink when the keyboard opens — it behaves like `vh` on native. `src/pages/MessagePage.jsx` handles this by manually subtracting `keyboardHeight` on `keyboardWillShow` (already correct; do not touch). This is why the input-font-size fix below is the *real* mobile win, and why other fixes stay 🖥️-safe rather than requiring runtime scoping.
8. **When you add a scope guard, drop a one-line comment** above the scoped block explaining the desktop vs. mobile intent, so a future maintainer doesn't "clean it up." Comment format: `// Mobile only: <why>. Desktop: <what stays the same>.`
9. **Run the verification at the end before reporting done.** If verification fails, do not mark the task complete — fix the failure or stop and report.

---

## Fix 1 — Input font sizes (📱 mobile-only; prevents iOS focus-zoom)

iOS Safari zooms into any input/textarea with computed `font-size < 16px` on focus. 11 TextFields in the repo explicitly set `fontSize: 13` inside an `sx` override, which triggers this zoom on mobile web and Capacitor iOS. Desktop dashboards intentionally use 13 px for density — DO NOT change desktop rendering.

**Pattern to apply everywhere below:** change the literal `fontSize: 13` inside `"& .MuiOutlinedInput-root": { ... }` to `fontSize: { xs: 16, md: 13 }`. Everything else in the `sx` (borderRadius, bgcolor, etc.) stays untouched.

Before each edit, add the scope comment `// Mobile only: iOS zooms on focus for inputs <16px. Desktop keeps 13px for density.` on the line immediately above the modified `sx` prop or on the line the `sx` prop starts on if the JSX is a single-liner (use a `{/* ... */}` JSX comment in that case so it doesn't break JSX parsing).

Apply to these exact locations:

1. `my-app/src/components/dashboard/TicketDetailModal.jsx:247` — moderator-search Autocomplete `renderInput` TextField
2. `my-app/src/components/dashboard/TicketDetailModal.jsx:253` — date TextField
3. `my-app/src/components/dashboard/TicketDetailModal.jsx:294` — reason TextField
4. `my-app/src/components/dashboard/TicketDetailModal.jsx:299` — notes TextField
5. `my-app/src/components/dashboard/TicketDetailModal.jsx:304` — duration TextField
6. `my-app/src/components/dashboard/TicketDetailModal.jsx:409` — reply TextField (multiline)
7. `my-app/src/components/dashboard/TicketDetailModal.jsx:473` — support reply TextField (multiline, maxRows=4)
8. `my-app/src/components/SupportModal.jsx:447` — chat reply TextField
9. `my-app/src/components/SupportModal.jsx:579` — support reply TextField
10. `my-app/src/components/LoginSupportModal.jsx:589` — chat reply TextField
11. `my-app/src/components/LoginSupportModal.jsx:892` — support reply TextField

Verification for Fix 1:

- Grep `fontSize: 13` in `my-app/src/` after the edit. There should be zero results inside `"& .MuiOutlinedInput-root"` blocks. Any standalone `fontSize: 13` outside input overrides (e.g., Typography) is NOT in scope and must not be touched.
- Grep `fontSize: { xs: 16, md: 13 }` — expect 11 new results, one per edit above.
- Eyeball one TextField per file to confirm the rest of the `sx` (borderRadius, bgcolor) is unchanged and the comment is present.

## Fix 2 — Stale `vh` → `dvh` swaps (🖥️ desktop-safe)

Five `vh`-based lengths remain while the rest of the codebase has already migrated to `dvh`. `dvh` is identical to `vh` on desktop and correctly handles dynamic browser chrome on mobile web. Do not add scoping.

Apply exactly:

1. `my-app/src/App.jsx:471` — `minHeight: "100vh"` → `minHeight: "100dvh"`
2. `my-app/src/App.jsx:505` — `minHeight: '100vh'` → `minHeight: '100dvh'` (preserve the single quotes)
3. `my-app/src/pages/FeedPage.jsx:664` — `minHeight: "calc(100vh - 100px)"` → `minHeight: "calc(100dvh - 100px)"`
4. `my-app/src/pages/MapPage.jsx:716` — `height: { xs: "40vh", md: "calc(100vh - 240px)" }` → `height: { xs: "40dvh", md: "calc(100dvh - 240px)" }`
5. `my-app/src/pages/MapPage.jsx:850` — `height: "calc(100vh - 240px)"` → `height: "calc(100dvh - 240px)"`
6. `my-app/src/pages/dashboard/ReportsPage.jsx:56` — `maxHeight: "90vh"` → `maxHeight: "90dvh"`
7. `my-app/src/components/TermsModal.jsx:151` — `maxHeight: { xs: "calc(88vh - env(safe-area-inset-top))", sm: "90vh" }` → `maxHeight: { xs: "calc(88dvh - env(safe-area-inset-top))", sm: "90dvh" }`

Do NOT touch:

- `my-app/src/components/ConfettiCanvas.jsx:39` `window.innerHeight` (canvas pixel sizing — correct as-is).
- `my-app/src/components/AppFooter.jsx:58` `window.innerHeight - vv.height > 100` (heuristic; covered by Fix 3).
- `my-app/src/App.css:137, 144` `100vw` / `50vw` (widths, not heights — no keyboard interaction).

Verification for Fix 2:

- Grep `100vh\|90vh\|88vh\|40vh` in `my-app/src/`. The only surviving matches should be in `ConfettiCanvas.jsx` (pixel-sizing, not CSS) and `AppFooter.jsx` (`window.innerHeight`), both explicitly listed as "do not touch."
- Grep `100dvh` — expect counts to increase by exactly the number of swaps made (5 new `dvh` tokens, since #4 changes both `xs` and `md` values and #7 changes both `xs` and `sm` values → 2 + 2 = 4 additional `dvh` tokens plus 5 from #1,#2,#3,#5,#6 → total new `dvh` tokens depends on grep granularity; the important check is that every `old_string` identified above is gone).

## Fix 3 — AppFooter web-keyboard heuristic mobile-width guard (📱)

`my-app/src/components/AppFooter.jsx:49-61` has a web fallback that listens to `window.visualViewport` and sets `keyboardOpen = true` whenever `window.innerHeight - vv.height > 100`. On desktop, that heuristic is currently a no-op by accident — pinch-zoom or devtools layout changes could trip it. Harden it by gating the web fallback on a narrow viewport.

**Current shape of the effect:**

```jsx
useEffect(() => {
  if (Capacitor.isNativePlatform()) {
    const show = Keyboard.addListener("keyboardWillShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardOpen(false));
    return () => { show.then((h) => h.remove()); hide.then((h) => h.remove()); };
  }
  // Web browser fallback
  const vv = window.visualViewport;
  if (!vv) return;
  const handle = () => setKeyboardOpen(window.innerHeight - vv.height > 100);
  vv.addEventListener("resize", handle);
  return () => vv.removeEventListener("resize", handle);
}, []);
```

Change the web fallback so it only activates on narrow viewports. Use `window.matchMedia` (cheaper than `useMediaQuery` here since this is inside an effect and we want to react to width changes too):

```jsx
useEffect(() => {
  if (Capacitor.isNativePlatform()) {
    const show = Keyboard.addListener("keyboardWillShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardOpen(false));
    return () => { show.then((h) => h.remove()); hide.then((h) => h.remove()); };
  }
  // Mobile-web only: visualViewport shrink heuristic. Desktop has no software keyboard,
  // so without this guard a pinch-zoom or devtools resize could hide the footer.
  const mq = window.matchMedia("(max-width:900px)");
  const vv = window.visualViewport;
  if (!vv) return;

  let attached = false;
  const handle = () => setKeyboardOpen(window.innerHeight - vv.height > 100);
  const attach = () => {
    if (mq.matches && !attached) {
      vv.addEventListener("resize", handle);
      attached = true;
    } else if (!mq.matches && attached) {
      vv.removeEventListener("resize", handle);
      setKeyboardOpen(false);
      attached = false;
    }
  };
  attach();
  mq.addEventListener("change", attach);
  return () => {
    mq.removeEventListener("change", attach);
    if (attached) vv.removeEventListener("resize", handle);
  };
}, []);
```

Important details:

- Reset `keyboardOpen` to `false` when detaching so a user who resizes their window from narrow → wide doesn't get stuck in keyboard-open state with a hidden footer.
- Keep the native branch above unchanged; it is already correctly scoped.
- The `900px` breakpoint matches the rest of the codebase's mobile threshold.

Verification for Fix 3:

- Grep `matchMedia` in `my-app/src/components/AppFooter.jsx` — expect at least one match.
- Open the file and confirm the native branch (`Capacitor.isNativePlatform()`) is still the first `if` inside the effect and returns its cleanup unchanged.
- Confirm the scope comment above the web fallback explains the desktop behavior.

---

## Verification — run before reporting done

Run each of these from the repo root. If any step fails, fix the edit or stop and report the failure. Do not mark the task complete on a failure.

1. **Lint.** `cd my-app && npm run lint` (or the equivalent for this repo — check `my-app/package.json` `scripts`). Zero new warnings introduced by your edits.
2. **Build.** `cd my-app && npm run build`. Must succeed. This compiles the Vite bundle and surfaces syntax errors from any edit.
3. **Grep sanity checks** (spell out each):
   - `grep -rn "fontSize: 13" my-app/src` — only Typography/label uses should remain; zero matches inside `MuiOutlinedInput-root` blocks.
   - `grep -rn "fontSize: { xs: 16, md: 13 }" my-app/src` — expect 11 matches across `TicketDetailModal.jsx`, `SupportModal.jsx`, `LoginSupportModal.jsx`.
   - `grep -rn "100vh\|90vh\|88vh\|40vh" my-app/src` — only matches allowed are in `ConfettiCanvas.jsx` and `AppFooter.jsx` per the do-not-touch list, plus `window.innerHeight` (which is not a `vh` token but may surface depending on regex).
   - `grep -rn "matchMedia" my-app/src/components/AppFooter.jsx` — expect ≥1 match.
4. **Smoke-test import paths.** Confirm `useMediaQuery` was NOT added to any file that doesn't need it — this PR only uses `window.matchMedia` inside AppFooter and does not add a new `useMediaQuery` import anywhere.
5. **Diff summary.** Before committing, print `git diff --stat` and make sure the only files changed are:
   - `my-app/src/App.jsx`
   - `my-app/src/pages/FeedPage.jsx`
   - `my-app/src/pages/MapPage.jsx`
   - `my-app/src/pages/dashboard/ReportsPage.jsx`
   - `my-app/src/components/TermsModal.jsx`
   - `my-app/src/components/SupportModal.jsx`
   - `my-app/src/components/LoginSupportModal.jsx`
   - `my-app/src/components/dashboard/TicketDetailModal.jsx`
   - `my-app/src/components/AppFooter.jsx`

   Any file outside that list is a bug — revert and re-do.
6. **Do NOT run the dev server or tests unless the user asks.** Build + lint + grep is the required contract.

## What to report back

Reply with:

1. A one-line summary ("Applied 3 fixes across 9 files; build + lint green.").
2. `git diff --stat` output.
3. Any surprises or deviations from this prompt.
4. A note if Fix 3's behavior on a resize from narrow → wide should also reset the imperative DOM style on the overlay (it doesn't need to; that's MessagePage and is native-only). Just confirm you didn't touch MessagePage.

Do not open a PR, do not commit, do not push. Leave the working tree dirty for the user to review.
