# MobileIntegration.md — Full Feature Parity Plan

## Context

The Lost & Hound mobile app (React Native + Expo) has the core scaffolding complete — auth, feed, map, messages, and settings. This plan covers every remaining feature needed for full parity with the web app, plus mobile-specific optimizations for App Store/Play Store readiness.

---

## Feature Audit — What We Have vs What's Missing

### Auth
- [x] Login with @northeastern.edu email
- [x] Sign up with first/last name
- [x] MFA TOTP enrollment (QR code display, manual key)
- [x] MFA TOTP verification
- [x] Device trust (remember 30 days)
- [x] Forgot password
- [x] Dark/light theme on login
- [x] Theme toggle on login
- [x] Terms & Conditions acceptance on signup
- [x] Email confirmation resend button
- [ ] Confetti animation on login success
- [ ] Password recovery deep linking (reset link opens app)

### Feed
- [x] Listing feed with search, category chips, filters
- [x] Type filter (All/Lost/Found)
- [x] Show/hide resolved
- [x] Pull-to-refresh
- [x] Item detail modal (tap to expand)
- [x] Mini map in detail modal
- [x] Claim/resolve own posts
- [x] **Create post screen** (report lost/found item)
- [x] Image upload in create post
- [x] Map pin picker in create post (auto-places on building, draggable)
- [x] Campus/building selector in create post
- [x] Importance slider in create post
- [x] Found/Lost toggle in create post
- [x] Report post button in detail modal
- [x] "Message poster" button in detail modal (navigates to correct conversation)
- [x] Sort by (Newest/Oldest/Most Important) — tap to cycle
- [x] "My Posts" filter toggle
- [x] Campus filter picker (horizontal chips)

### Map
- [x] Campus picker
- [x] Tap to place search pin
- [x] Radius circle
- [x] Radius slider (50/150/300/500ft)
- [x] Pins only visible within radius
- [x] Nearby items panel
- [x] Tap listing to open detail modal
- [x] Tap pin to open detail modal
- [ ] Building search dropdown
- [x] Type filter (All/Lost/Found) on map
- [x] Show/hide resolved toggle on map

### Messages
- [x] Conversation list
- [x] Message thread with realtime
- [x] Optimistic message send
- [x] System messages
- [x] Closed conversation handling
- [x] Safety warning banner
- [ ] Delete/close conversation
- [x] Report user button (flag icon in thread header)
- [ ] Unread message count badge on tab

### Settings
- [x] View email
- [x] Edit name
- [x] Change password
- [x] Default campus picker
- [x] Logout
- [x] Delete account with confirmation
- [x] Theme toggle (via header)
- [x] Timezone picker (horizontal chips)
- [ ] Theme mode display (auto/light/dark label)

### App-Wide
- [x] Dark/light theme auto-detection
- [x] Theme toggle in every screen header
- [x] Glassmorphism tab bar with blur
- [x] Tab icons (Feed, Map, Messages)
- [x] Push notification registration (Expo Go limited)
- [x] Push notification on new message (backend trigger)
- [x] **Report modal** (report post or user — with reason selection, theft warning, details)
- [x] **Shared ItemDetailModal** (consistent detail view on feed + map with mini map, message poster, report)
- [x] App logo in headers + login screen + app.json (icon, splash, adaptive icon)
- [ ] **Terms modal** (view terms & conditions)
- [ ] Footer links (Credits, Disclaimer, Privacy, Terms)
- [ ] Loading skeletons instead of spinners (deferred to Tailwind redesign)
- [x] Haptic feedback on key actions (send message, create post, report, message poster)
- [x] Offline error handling (red banner at top when disconnected)

---

## Implementation Plan — Ordered by Priority

### Batch 1: Create Post (Critical — can't use app without it) ✅ COMPLETE
**Files:** `mobile/app/(tabs)/feed.tsx` (add modal), `mobile/components/CreatePostModal.tsx` (new)

- Found/Lost toggle
- Title, category dropdown, campus/building selector
- "Found at" specific location text
- Description
- Importance slider (Low/Medium/High)
- Image picker (expo-image-picker) + upload via signed URL
- Submit → POST /api/listings → add to local items
- References: `my-app/src/pages/FeedPage.jsx:366-690` (NewItemModal)

### Batch 2: Report Modal + Message Poster (Safety — App Store requirement) ✅ COMPLETE
**Files:** `mobile/components/ReportModal.tsx`, `mobile/components/ItemDetailModal.tsx`, update feed.tsx + map.tsx + messages.tsx

- Report types: "post" and "user"
- Reason selection (Stolen item, Harassment, Spam, etc.)
- Optional details text (250 char max)
- Submit → POST /api/reports
- Add report button to: detail modal (feed + map), messages thread header
- Add "Message Poster" button to detail modal → POST /api/conversations (find-or-create) → navigate to messages
- References: `my-app/src/components/ReportModal.jsx`

### Batch 3: Terms Modal + Signup Terms Acceptance ✅ COMPLETE
**Files:** `mobile/components/TermsModal.tsx` (new), update login.tsx

- Scrollable terms content (13 sections from web)
- Must scroll to bottom before accept button enables
- Show before signup completes (same flow as web)
- Read-only mode accessible from settings/footer
- References: `my-app/src/components/TermsModal.jsx`

### Batch 4: Conversation Management ✅ COMPLETE
**Files:** update messages.tsx

- Delete/close conversation (swipe-to-delete or long-press)
- Unread message count badge on Messages tab
- References: `my-app/src/pages/MessagePage.jsx:43-52` (hideConversation)

### Batch 5: Missing Filters + Sort ✅ COMPLETE
**Files:** update feed.tsx, map.tsx, settings.tsx

- Feed: Sort dropdown (Newest/Oldest/Most Important)
- Feed: "My Posts" toggle
- Feed: Campus filter dropdown
- Map: Type filter toggle (All/Lost/Found)
- Map: Show resolved toggle
- Settings: Timezone picker
- Settings: Theme mode label

### Batch 6: Polish + Store Readiness ✅ COMPLETE
**Files:** various

- App icon (1024x1024) + splash screen with Lost & Hound branding
- Email confirmation resend on login
- Confetti animation on successful login
- Loading skeletons (feed cards, message list)
- Haptic feedback (expo-haptics) on send message, create post, resolve
- Offline detection banner
- Footer/about section (credits, disclaimer, privacy, terms links)
- Deep linking for password reset emails

---

## App Optimization Plan

### Performance
- [ ] Shared items state lifted to app level (like web) — avoid refetching on tab switch
- [ ] Message cache per conversation (like web) — instant tab switching
- [ ] FlatList optimization: `getItemLayout`, `maxToRenderPerBatch`, `windowSize`
- [ ] Image caching with expo-image (faster than RN Image)
- [ ] Lazy load map screen (don't init MapView until tab is focused)

### Security
- [ ] Certificate pinning for API calls (prevent MITM)
- [ ] Jailbreak/root detection warning
- [ ] Biometric auth option (Face ID / fingerprint) as alternative to TOTP
- [ ] Auto-logout on app background timeout (configurable)
- [ ] Secure keyboard for password fields (prevent screenshots)

### UX
- [ ] Keyboard avoiding improvements (test all input screens)
- [ ] Gesture navigation (swipe back on threads)
- [ ] Animated page transitions
- [ ] Pull-to-refresh on messages conversation list
- [ ] Empty states with illustrations
- [ ] Error toast/snackbar instead of silent failures

### Store Submission
- [ ] App Store screenshots (iPhone 6.7")
- [ ] Play Store screenshots
- [ ] App description (short + long)
- [ ] Privacy policy URL
- [ ] Data safety declarations (Google Play)
- [ ] App privacy labels (Apple)
- [ ] Content rating questionnaire
- [ ] Test on multiple device sizes
- [ ] Test on Android emulator

---

## Verification

Each batch should be tested end-to-end:
1. Create post → verify it appears in feed and on map
2. Report post/user → verify report appears in web mod dashboard
3. Terms acceptance → verify signup blocked without acceptance
4. Delete conversation → verify it disappears, other user sees system message
5. All filters → verify correct items shown/hidden
6. Store submission → verify screenshots, descriptions, policies complete
