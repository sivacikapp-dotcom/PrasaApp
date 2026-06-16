# Kronika — Family Chronicle PWA

A progressive web application for capturing, archiving, and presenting family memories. Contributors submit moments (text, photos, video, voice), which chroniclers curate into structured events and a visual timeline.

## Features

**For contributors**
- Submit memories with text notes, photos, video clips, and voice recordings
- GPS location capture with automatic reverse-geocoding (OpenStreetMap Nominatim)
- Assign submissions to family groups with per-group access control
- Tag other family members in contributions
- Full offline support — submissions saved locally and synced on reconnect

**For chroniclers**
- Review and enrich incoming contributions (add context, verify dates, transcribe voice via OpenAI Whisper)
- Organize contributions into chronicle events and event groups
- Visual route map (Relive-style) using Mapbox GL with GPS track replay
- Soft-delete with trash/restore workflow

**For admins**
- Approve/block user registrations
- Manage roles (contributor / chronicler / admin)
- Create and manage family groups with per-group member access
- Manage hashtag taxonomy

**Cross-cutting**
- Push notifications (Firebase Cloud Messaging) with per-user delivery preferences
- Email notifications on new contributions and user registrations (Resend)
- Multilingual UI — Slovak, Czech, English, French, Polish, Chinese
- Dark/light mode, install-as-app (PWA manifest + service worker)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions) |
| Language | TypeScript 5 |
| Auth | Firebase Authentication (Google OAuth) |
| Database | Cloud Firestore (real-time listeners) |
| Storage | Firebase Storage |
| Push | Firebase Cloud Messaging |
| Email | Resend |
| Maps | Mapbox GL / react-map-gl |
| AI | OpenAI Whisper (voice transcription) |
| Styling | Tailwind CSS v4 |
| Validation | Zod |
| Linting | ESLint 9 + eslint-plugin-security |
| CI | GitHub Actions — CodeQL security scanning |

## Architecture

```
app/
├── api/                  # Next.js API routes (server-side, Firebase Admin SDK)
│   ├── notify/           # Email notifications via Resend
│   ├── push-notify/      # FCM push dispatch
│   └── transcribe/       # OpenAI Whisper voice-to-text
├── admin/                # User management, group & hashtag administration
├── chronicler/           # Contribution review, event compilation
├── dashboard/            # Contributor personal feed
└── events/               # Public event timeline + visual route map

lib/
├── firebaseAdmin.ts      # Firebase Admin SDK singleton (server-only)
├── apiAuth.ts            # Server-side Bearer token verification helper
├── contributionService.ts
├── eventService.ts
├── notificationService.ts
└── ...

firestore.rules           # Firestore security rules (role-based, IDOR-protected)
storage.rules             # Firebase Storage rules (per-uid write isolation)
```

**Authorization model:**
- All Firestore reads/writes are governed by server-side `firestore.rules` — the client cannot bypass them
- API routes verify Firebase ID tokens via Admin SDK (`lib/apiAuth.ts`) before processing any request
- Role hierarchy: `contributor` → `chronicler` → `admin`, stored in Firestore, enforced in both rules and UI
- Contributors can only read contributions where they appear in `visibleToIds` (IDOR protection)

## Security

A full security audit was performed covering authentication, input validation, IDOR, XSS, SSRF, and dependency vulnerabilities:

- **API authentication** — every server route verifies a Firebase ID token (`Authorization: Bearer`)
- **SSRF protection** — `/api/transcribe` whitelists only Firebase Storage origins
- **Input validation** — Zod schemas on all API request bodies
- **XSS prevention** — HTML email templates escape all user-controlled strings
- **Security headers** — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
- **Firestore rules** — role + status checks on every collection; users cannot modify their own roles
- **Storage rules** — contributors write only to their own `uid/` path; chroniclers to a separate `chronicler/` prefix
- **Dependency scanning** — `npm audit` clean at HIGH level; CodeQL scans on every push to `main`

## Local Development

```bash
# 1. Clone and install
git clone https://github.com/sivacikapp-dotcom/PrasaApp.git
cd PrasaApp
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Fill in Firebase config, OpenAI key, Mapbox token, Resend key

# 3. Start development server
npm run dev
```

You will need a Firebase project with:
- Authentication (Google provider enabled)
- Firestore database (deploy `firestore.rules`)
- Storage (deploy `storage.rules`)
- Cloud Messaging (generate VAPID key)

## Deployment

The app is configured for both **Vercel** (`vercel.json`) and **Firebase Hosting** (`firebase.json`).

```bash
# Vercel (recommended for Next.js)
npx vercel

# Firebase Hosting
npm run build && firebase deploy
```

Set all environment variables from `.env.example` in your hosting provider's dashboard. `FIREBASE_SERVICE_ACCOUNT_JSON` (for Admin SDK) must be a server-side secret — never use `NEXT_PUBLIC_` prefix for it.
