<div align="center">

<h1>Lost & Hound</h1>

**The smarter campus lost & found — built for students, by students.**

Post what you've found. Find what you've lost. Connect with your campus in real time.

<br />

[![Live](https://img.shields.io/badge/Live%20at-thelostandhound.com-A84D48?style=for-the-badge)](https://thelostandhound.com)
[![App Store](https://img.shields.io/badge/iOS-App%20Store-000000?style=for-the-badge&logo=apple)](https://thelostandhound.com)
[![Campuses](https://img.shields.io/badge/12%20Global-Campuses-6366f1?style=for-the-badge)](#campuses)
[![AI Safety](https://img.shields.io/badge/AI-Content%20Screening-0ea5e9?style=for-the-badge)](#ai-powered-safety)
[![Real-Time](https://img.shields.io/badge/Real--Time-Live%20Updates-16a34a?style=for-the-badge)](#real-time-everything)

</div>

<img src="docs/hero.png" alt="Lost & Hound — The smarter campus lost and found" width="100%" style="border-radius:14px;" />

---

## iOS App

Lost & Hound is available on the Apple App Store for iPhone.

- Native iOS experience built with Capacitor
- Face ID sign-in
- Push notifications for new messages and community updates
- Full feature parity with the web app — feed, map, messaging, settings

> **Currently under App Store review.** Visit [thelostandhound.com](https://thelostandhound.com) in the meantime.

---

## The Problem

Every campus has the same broken system: a group chat full of "anyone seen my keys?", a whiteboard in the dorm lobby, maybe a lost-and-found closet nobody knows how to access. Items go unclaimed. Owners never find out someone handed their wallet to the front desk.

**Lost & Hound fixes that.**

One platform. Real-time listings. A live map. Direct messaging between finder and owner — no phone numbers, no public posts. Items found and returned, the way it should work.

---

## What It Looks Like

### The Feed
Every lost and found listing on your campus in one clean, filterable view. Search by keyword, filter by category, sort by importance or date. High-priority items — like a Husky Card lost before an exam — float to the top.

### The Map
Every listing with a location drops a pin on a live campus map. Open the map, find a cluster near the library, tap the pin — full listing details appear instantly. Filter by category and search radius without leaving the map.

### Messages
Found something? Message the owner directly through Lost & Hound. Conversations are attached to the listing so context is never lost. Real-time delivery — messages appear instantly on both sides without refreshing.

---

## Features

### Posting & Browsing

- **Lost & Found listings** — post with a title, description, category, importance level, optional photo, and exact campus pin drop
- **Auto-expiry** — old listings clean themselves up automatically, so the feed stays current
- **HEIC photo support** — upload straight from your iPhone camera roll, no conversion needed
- **Categories** — Husky Card, Keys, Wallet/Purse, Bag, Jacket, Electronics, and more
- **Importance levels** — mark High, Medium, or Low so the most urgent items surface first
- **Editing & deletion** — update or remove your own listings at any time

### The Map

- **Live Google Maps integration** — pins appear the moment a listing is posted
- **Campus switching** — jump between any of 12 global Northeastern campuses instantly
- **Building search** — type a building name to navigate the map directly
- **Radius filtering** — narrow results to items within 50 ft, 150 ft, 300 ft, or 500 ft of a location
- **Type & category filters** — show only Lost items, only Found items, or a specific category

### Messaging

- **Real-time direct messages** — no polling, no refresh, instant delivery both ways
- **Listing-linked conversations** — every conversation is tied to a specific item
- **Unread badge** — a live counter in the nav bar shows how many messages are waiting
- **Conversation management** — close or hide threads once resolved

### Leaderboard

- **Points system** — earn points for contributing: +15 for posting a found item, +25 for marking an item returned, +5 for posting a lost item
- **Live sidebar** — top 10 players displayed alongside the feed on desktop, with your rank shown if you're outside the top 10
- **Full leaderboard modal** — view the top 50 players, points breakdown, and rank tiers from a single expandable view
- **Rank tiers** — six progression tiers from Pup (0 pts) to Top Dog (500+ pts), each with a unique badge
- **Mobile access** — trophy icon in the navbar opens the full leaderboard on smaller screens

### Reporting & Safety

- **Report listings or users** — flag anything inappropriate directly from the feed or map
- **Stolen item reports** — dedicated high-priority queue separate from regular lost & found
- **Feedback submission** — send feature requests or suggestions directly to the team
- **Bug reports** — report issues with severity levels that route straight to the engineering board
- **Support tickets** — open a help request and get a response from a real moderator

---

## Campuses

Lost & Hound is built for all Northeastern University global campuses. Set your home campus once — the feed and map default to your location.

| | Campus | Location |
|---|---|---|
| 🇺🇸 | Boston | Massachusetts |
| 🇺🇸 | Burlington | Massachusetts |
| 🇺🇸 | New York City | New York |
| 🇺🇸 | Charlotte | North Carolina |
| 🇺🇸 | Miami | Florida |
| 🇺🇸 | Portland | Maine |
| 🇺🇸 | Seattle | Washington |
| 🇺🇸 | San Jose | California |
| 🇺🇸 | Oakland | California |
| 🇺🇸 | Arlington | Virginia |
| 🇨🇦 | Toronto | Ontario |
| 🇬🇧 | London | United Kingdom |

---

## Security & Account Safety

Lost & Hound takes security seriously — your account and your data are protected at every layer.

**Two-Factor Authentication**
Enable 2FA from your settings page. Every login requires a one-time verification code in addition to your password. Trusted devices are remembered so you aren't re-prompted on the same machine.

**Email verification**
Password reset links are delivered by email and built to be safe against Microsoft SafeLinks pre-fetch attacks — the reset token isn't consumed until you actually click it.

**Account suspension**
Accounts that violate community guidelines can be suspended temporarily or permanently. The affected user sees the exact reason and end date, with no ambiguity.

**Privacy-first messaging**
Direct messages never expose phone numbers or personal contact information. You communicate through the platform — that's it.

---

## AI-Powered Safety

**Every photo is screened before it goes live.**

When a user uploads an image to a listing, it's automatically checked by Google Cloud Vision AI. Explicit, violent, or otherwise unsafe content is rejected before it ever reaches the feed — protecting every member of the community automatically.

**Profanity filtering** on listing titles and descriptions catches policy violations at submission time, not after the fact.

---

## Real-Time Everything

Lost & Hound doesn't ask you to refresh.

- New listings appear in the feed instantly
- Map pins drop the moment someone posts
- Message delivery is live on both sides
- The unread badge updates without a page reload
- Moderator dashboards sync the instant a ticket or report changes

This is powered by database-level subscriptions — changes propagate from server to every connected client in real time.

---

## Moderation Dashboard

Moderators get a dedicated control panel with a full suite of tools to keep the platform healthy.

| Section | What It Does |
|---|---|
| **Reports** | Review flagged listings and user reports — approve or dismiss |
| **Stolen Reports** | Priority queue for theft and ownership disputes |
| **Feedback** | Track user suggestions — mark Open, In Progress, or Resolved |
| **Bugs** | Engineering-style bug board with Critical / High / Medium / Low severity |
| **Support** | Claim and respond to user help tickets |
| **My Work** | Personal queue of assigned tickets and overdue items |
| **Statistics** | Live platform stats: total users, active listings, referral sources, weekly growth |

The dashboard updates live — no refresh button. New tickets, reports, and messages appear the instant they come in.

---

## For Site Owners

Owners get an additional **Finances** view inside the dashboard — a private billing page showing live infrastructure costs, API usage tracking, projected vs. actual monthly spend, and custom expense tracking across all services. Only visible to designated owner accounts.

---

## How It Works — In 60 Seconds

```
1. Sign up with your Northeastern email
2. Choose your campus — Boston, London, New York, or any of 12 locations
3. Browse the live feed or open the map
4. Post something you found, or report something lost
5. Message the owner or finder directly — no middleman
6. Mark the item resolved when it's returned
```

---

## Tech Stack

Lost & Hound is built on a production-grade stack chosen for real-time performance, security, and reliability.

| Layer | Technology |
|---|---|
| Frontend | React 19, Material UI v7, Vite |
| Mobile | Capacitor (iOS) |
| Backend | Node.js, Express 5 |
| Database & Auth | Supabase (PostgreSQL) |
| Real-Time | Supabase Realtime WebSocket subscriptions |
| Maps | Google Maps JavaScript API |
| AI Safety | Google Cloud Vision API |
| Push Notifications | OneSignal |
| Email | Resend |
| Hosting | Railway |

**Security architecture:**
- All API routes require authenticated Supabase sessions
- Role-based middleware guards on moderator and owner routes
- 2FA enforced server-side — no route access without verification
- Row-Level Security on all database tables
- Parameterized queries throughout — no SQL injection surface
- AI image moderation on every upload before storage
- Device token validation to prevent session fixation

---

## Deployment

Auto-deploy from git pushes is **disabled**. All deploys are triggered manually via GitHub Actions.

**To deploy:**
1. Go to the **Actions** tab in GitHub
2. Select **Deploy Lost & Hound**
3. Click **Run workflow**
4. Choose target (`vercel`, `railway`, or `both`) and environment (`production` or `preview`)

**Required secrets** (set in repo Settings > Secrets and variables > Actions):
| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | Vercel personal access token |
| `VERCEL_ORG_ID` | Vercel team/org ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |
| `RAILWAY_TOKEN` | Railway project token |

---

## Disclaimer

Lost & Hound is an independent student project and is **not officially affiliated with or endorsed by Northeastern University**.

---

<div align="center">

Built with care at Northeastern University &nbsp;·&nbsp; [thelostandhound.com](https://thelostandhound.com)

© 2026 Lost & Hound. All rights reserved.

</div>
