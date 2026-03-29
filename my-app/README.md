# Lost & Hound Frontend (Vite)

This folder contains the React + Vite frontend for Lost & Hound.

For full project documentation (features, setup, Supabase schema expectations), see the repository README:

- `../README.md`

## Quick Start

From this folder (`my-app/`):

```bash
npm install
npm run dev
```

If this is your first time setting up the repo, also install root dependencies from the repository root:

```bash
cd ..
npm install
```

## Environment Variables

Create `my-app/.env`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

## Time and Input Rules

### Timezone behavior

- Users can choose a timezone in Settings.
- Available timezones: Eastern, Central, Mountain, Pacific, and London.
- Default timezone is Eastern Time unless changed by the user.
- Time formatting follows the selected timezone across feed, map, messages, moderation, and suspension dates.
- Bare ISO datetime strings are normalized as UTC before timezone conversion.

### Character limits

- First name: 25 max characters.
- Last name: 25 max characters.
- Password input: 32 max characters in login/sign-up UI.
- Message composer: 500 max characters.
- Report custom reason ("Other"): 50 max characters.
- Report details: 250 max characters.
- New listing title: 50 max characters.
- New listing `found_at`: 50 max characters.
- New listing description: 250 max characters.

Name length limits are enforced in both frontend forms and backend profile validation.
