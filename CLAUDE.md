# CLAUDE.md

This file provides guidance to Claude Code when working
with code in this repository.

## Project Overview

Seli Mobile is a React Native (Expo) app for immigration
applicants. Users browse destinations and visa types,
check eligibility, find agencies and agents, book
consultations, create applications, upload documents,
message their agent, pay, and track progress.

> The app is branded **Seli**. The repo, directory and
> legacy infra ids (bundle `com.durintech.japamobile`,
> the `japa-platform` prod Firebase project) intentionally
> stay `japa` — don't "fix" them.

**Tech Stack:** React Native 0.85 + Expo 56, React 19,
TypeScript 6, Zustand 5, TanStack Query 5, Firebase via
`@react-native-firebase` 24 (Auth, Analytics, Crashlytics,
Messaging), Expo Router.

**Styling is inline styles built from design tokens**, not
utility classes — see [Design System](#design-system).
NativeWind and Tailwind are still in `package.json` but are
vestigial (~5 files use `className`).

## Commands

```bash
npm start                  # Expo dev server
npm run ios                # expo run:ios (local prebuild)
npm run android            # expo run:android
npm run lint               # ESLint — NOTE: runs with --fix
npm run build:dev          # EAS development build (all platforms)
npm run build:preview      # EAS preview build
npm run build:prod         # EAS production build
npx tsc --noEmit           # Typecheck (no dedicated script)
```

**Expo Go will not work** — the app uses
`@react-native-firebase/*` native modules. You need a
development build (`npm run build:dev`) or a local prebuild
(`npm run ios` / `npm run android`).

`npm test` exists but there are currently **no test files**
in the repo.

## Environment Configuration

The app targets a different Firebase project and backend per
environment, selected by **`APP_ENV`**. There are no manual
config-file swaps.

| `APP_ENV`     | Firebase project | Backend            |
| ------------- | ---------------- | ------------------ |
| `development` | `durin-seli-dev` | dev Cloud Function |
| `staging`     | `durin-seli-dev` | (same as dev)      |
| `production`  | `japa-platform`  | prod               |

- `app.config.ts` reads `APP_ENV`, picks the native config
  from `firebase/<env>/`, and bakes the project id + API URL
  into expo `extra`.
- `src/config/env.ts` surfaces those baked values at
  runtime. **Nothing at runtime reads `process.env`** — that
  is what stops the Firebase project Auth mints tokens for
  from drifting away from the backend they're sent to (a
  mismatch 401s every authenticated request).
- EAS build profiles set `APP_ENV` (see `eas.json`). Local
  runs default to `development`, i.e. the **deployed** dev
  backend.

```bash
# .env — see .env.sample
EXPO_TOKEN=                     # EAS builds/submits (CI)
# APP_ENV=development           # override for local runs
# EXPO_PUBLIC_USE_EMULATOR=true # opt into the LOCAL emulator suite
```

The Auth emulator is **opt-in via `EXPO_PUBLIC_USE_EMULATOR`,
never gated on `__DEV__`**. A normal dev build talks to real
Firebase Auth on `durin-seli-dev`; connecting to an emulator
there mints tokens the deployed backend rejects.

## Architecture

### Directory Structure

```text
src/
  app/                     # Expo Router (file-based)
    (auth)/                # welcome, login, register, otp, forgot-password
    (onboard)/             # passport, country, personal-info, complete
    (tabs)/                # home, explore, agents, tracker, profile
    agency/[id]            agent/[id]        application/[id]
    destination/[id]       visa/[id]         self-service/[id]
    messages/              consultation/[id] book/[agentId]
    documents  shared-document/[id]  eligibility/  payments  pay
    settings  notifications  subscription  verify-identity  ...
  components/
    explorer/              # THE design system + live-data mappers
    auth/                  # FeatureGate
    ui/themed/             # LEGACY blue-theme kit (one consumer left)
  config/env.ts            # resolved environment (see above)
  hooks/                   # TanStack Query hooks, one file per domain
  services/                # api, auth, analytics, push-notification, users
  stores/                  # auth, onboarding, settings (Zustand)
  types/                   # mirrors backend types, `string` dates
  providers/               # QueryProvider, ThemeSync
```

### Design System

`src/components/explorer/` is the whole visual language —
the "Destination Explorer" design, which **is** the app (it
replaced the old blue `(tabs)` shell).

- **`theme.ts`** exports `EX` (colors, radii, shadows) and
  `displayText()`. Coral `#F4516C` on cream `#FFFBF5`, ink
  `#171326`, Space Grotesk display font.
- **`icons.tsx`** exports `Ic` — used by ~40 files. Prefer it
  over `lucide-react-native`.
- **`primitives.tsx`**, `Tile.tsx`, `AuthShell.tsx` —
  shared building blocks (`Pill`, `GlassButton`, …).
- Screens use **inline `style={{ … }}` objects** referencing
  `EX` tokens. Follow the surrounding file; don't introduce
  `className`.

`components/ui/themed` and `hooks/useTheme` are the previous
blue design and survive only in `+not-found.tsx`. Don't build
on them.

### Live-data mappers

`components/explorer/live*.ts` convert backend types into the
shapes the Explorer screens render (`liveApplications`,
`liveDocuments`, `liveMessaging`, `liveAgencies`, …). Screens
fall back to the demo fixtures in `data.ts` when a query is
empty or failing, so the UI is never blank.

**Consequence to watch:** a screen that filters mapped data
can silently drop records. Documents whose `requirementId`
isn't a real requirement (agency-filed uploads, `docreq:<id>`
asks) had to be collected into an explicit "Other documents"
section or they vanished from the self-service screen.

### Auth Flow

```text
App start
  -> authService.onAuthStateChanged -> auth.store
  -> not authenticated + outside (auth)  -> /(auth)/welcome
  -> authenticated + on (auth)/stranded  -> /(tabs)/home
```

The root guard in `src/app/_layout.tsx` only arbitrates
signed-in vs signed-out. It does **not** force
`(onboard)` — onboarding screens are navigated to
explicitly.

**Log in through the store, not `authService`.**
`useAuthStore.loginWithEmail()` sets `isAuthenticated`
synchronously before you navigate; calling the service
directly leaves the store signed-out until the async
listener catches up, and the guard bounces the user back to
`/welcome`.

### Data Flow

```text
Screen -> TanStack Query hook -> apiService -> Backend API
                                     |
                             Firebase ID token
                             (axios interceptor)
```

## API Integration

**Base URL:** `API_URL` from `@/config/env` (never
`process.env`).

**Auth:** Firebase ID token as a `Bearer` header, injected by
a request interceptor.

**401 handling** (`api.service.ts`) is deliberately not a
blanket sign-out: it force-refreshes the token and replays
the request once, and only tears the session down when a user
is actually signed in. A 401 is often just a stale token, or
a stray request fired before Firebase restored the user on
cold start.

**Response format:**

```typescript
{
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
```

### Hooks by domain

One file per domain in `src/hooks/`, each exporting query and
mutation hooks; mutations invalidate related query keys.

| File | Covers |
| ---- | ------ |
| `useApplications` | applications, timeline, documents-for-app |
| `useVisaTypes` | visas, search, popular, requirements |
| `useCountries` | countries, countries-with-visas |
| `useAgents` / `useAgencies` | agents, reviews, public agency pages |
| `useConsultations` | booking, cancelling |
| `useDocuments` | upload URL, create, download, **shared documents** |
| `useMessaging` | conversations, messages, unread |
| `useNotifications` | list, unread count, mark read |
| `usePaymentRequests` | approve / reject |
| `useSubscription` | plans, checkout, my subscription |
| `useEligibility` | questions, submit, pre-check, history |
| `useVerification` | identity submission |
| `useAuthorization` | `useFeature()` / ability checks |

Backend route gotchas (they bite every time):

- messaging mounts at **`/conversations`**, not
  `/messaging/conversations`
- notifications use **`body`** (not `message`) and
  **`relatedEntityId`** (not `referenceId`)
- `/document-instances/*` is agent-only and 403s for a
  client — **`/document-instances/shared`** is the app's only
  way in

## Key Patterns

- **Types** in `src/types/` mirror backend types but use
  `string` for dates instead of Firestore `Timestamp`.
- **Firebase** uses the modular API: `getApp()`, `getAuth()`,
  `getAnalytics()`, `getMessaging()`.
- **Push notifications**: `push-notification.service.ts`,
  initialized by `auth.store` after login and cleaned up on
  logout.
- **Analytics**: `services/analytics.service.ts`.
- **Path alias**: `@/*` → `./src/*`.
- **Dates**: `date-fns`, plus `explorer/liveDate.ts` for the
  Explorer's formats.

## Authorization constants (ALWAYS use)

- **Never hardcode role / feature / limit string literals**
  (`'client'`, `'messaging'`, etc.). Reference the named
  constants from `@durin-tech/authz`: **`ROLES`**,
  **`FEATURES`**, **`LIMITS`**, and groups like
  **`AGENT_SIDE_ROLES`**. (Mobile is on v0.1.1, which does
  export these at runtime — unlike the portal's v0.1.0.)
- Gate features via `useAuthorization()` / `useFeature()` and
  `<FeatureGate feature={FEATURES.X}>` — the backend remains
  authoritative.

## Committing (read before your first commit)

Three pre-commit hooks are misconfigured and block every
commit. Working invocation, on a feature branch:

```bash
SKIP=pre-commit-update,prettier,markdownlint git commit ...
```

- **`no-commit-to-branch`** blocks `dev` and `main` outright.
  Work goes on a branch → PR → merge (`gh pr create --base dev`).
- **`pre-commit-update`** exits 1 whenever upstream hook
  versions have moved on — i.e. always.
- **`prettier` vs `eslint`**: the pinned `mirrors-prettier`
  v3.1.0 and the newer prettier inside the eslint config
  disagree about parens in
  `useApplication(wantLive ? (id ?? '') : '')`; each undoes
  the other. eslint is the one that passes.
- **`markdownlint`**: `README.md` already failed on `dev`
  before any current work; its 80-column rule can't fit the
  environment table.

Worth fixing properly — right now nobody can commit without
knowing the incantation.

## CI

`.github/workflows/`: `preview.yml` (OTA EAS Update on every
PR into `dev`, posts a QR code), `preview-native.yml` for
native-touching branches, `development.yml`, `production.yml`.

**`web.output` is `"static"`, so `expo export` imports every
route file in Node at build time.** Any module-scope Firebase
call is therefore a build-time landmine — it throws
`No Firebase App '[DEFAULT]' has been created` and fails the
preview job. `auth.service.ts` still calls
`getAuth(getApp())` at module scope; making it lazy is the
durable fix. Bumping `expo` / `expo-router` has already
triggered this once.

## Testing with Seed Data

Run `npm run seed:dev` in `japa-backend` (or `npm run seed`
against the emulator). All seed users share the password
`password123`.

Client accounts for mobile testing:

- `john.doe@example.com` — application under review
- `jane.smith@example.com` — pending documents
- `ahmed.ali@example.com` — approved
- `tunde.bakare@example.com` — pending payment

Agency-side accounts (portal): `owner@selitest.com`,
`agent1@selitest.com`, `agent2@selitest.com`,
`admin@selitest.com`.
