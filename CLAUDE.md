# CLAUDE.md

This file provides guidance to Claude Code when working
with code in this repository.

## Project Overview

JAPA Mobile is a React Native (Expo) app for immigration
applicants. Users browse visa types, check eligibility,
find agents, book consultations, create applications,
upload documents, and track progress.

**Tech Stack:** React Native 0.79 + Expo 53, TypeScript,
TailwindCSS (NativeWind), Zustand, React Query, Firebase
(Auth, Crashlytics, Analytics)

## Commands

```bash
npx expo start            # Start Expo dev server
npx expo start --android  # Start on Android
npx expo start --ios      # Start on iOS
npm run lint              # Run ESLint
npm test                  # Run Jest tests
eas build --profile development  # Dev build via EAS
```

## Architecture

### Directory Structure

```text
src/
  app/                     # Expo Router (file-based)
    (auth)/                # Login, register, etc.
    (onboard)/             # Passport, country, etc.
    (tabs)/                # Main tab navigation
      index.tsx            # Home screen
      apply/               # Visas, agents
      me/                  # Profile, apps, settings
  components/
    ui/themed/             # Screen, Card, Button, etc.
    agents/                # AgentCard, etc.
    applications/          # ApplicationCard
    consultation/          # DatePicker, TimeSlotPicker
    payment/               # PaymentMethodSelector
  hooks/                   # React Query hooks
  services/
    api.service.ts         # Axios + Firebase auth
    auth.service.ts        # Firebase Auth wrapper
    analytics.service.ts   # Firebase Analytics
  stores/                  # Zustand stores
  types/                   # TypeScript definitions
  mock_data/               # Legacy mock data
  utils/                   # Helpers
```

### Auth Flow

```text
App Start -> Firebase Auth listener -> Check state
  -> Not authenticated -> /(auth)/login
  -> Authenticated, not onboarded -> /(onboard)
  -> Authenticated, onboarded -> /(tabs)
```

### Data Flow

```text
Screen -> React Query hook -> apiService -> Backend API
                                |
                         Firebase Auth token
                         (auto-injected)
```

### State Management

- **Zustand** (persistent): `auth.store.ts` (user,
  profile), `settings.store.ts` (theme, language),
  `onboarding.store.ts`
- **React Query**: Server state (applications, visas,
  countries, agents, consultations, documents,
  notifications)
- **Context API**: `OnboardingContext` for onboarding
  form flow

## API Integration

**Base URL:** `EXPO_PUBLIC_API_URL` env var, defaults to
`http://localhost:5001/japa-platform/us-central1/api`

**Auth:** Firebase ID token sent as `Bearer` token via
axios interceptor. 401 responses auto-sign-out and
redirect to login.

**Response format:**

```typescript
{
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
```

### Key Endpoints Used

| Endpoint | Hook | Screen |
| -------- | ---- | ------ |
| `GET /users/me` | `fetchProfile()` | Profile |
| `POST /users/onboarding` | `completeOnboarding()` | Onboard |
| `GET /countries` | `useCountries()` | Apply |
| `GET /visas` | `useVisaTypes()` | Apply |
| `GET /visas/popular` | `usePopularVisaTypes()` | Home |
| `GET /visas/search` | `useVisaSearch()` | Apply |
| `GET /.../visas/:id` | `useVisaType()` | Detail |
| `GET /applications` | `useApplications()` | Me |
| `GET /applications/:id` | `useApplication()` | Detail |
| `GET /.../timeline` | `useAppTimeline()` | Detail |
| `POST /applications` | `useCreateApp()` | Apply |
| `GET /agents` | `useAgents()` | Agents |
| `GET /agents/top` | `useTopAgents()` | Home |
| `GET /agents/:id` | `useAgent()` | Detail |
| `GET /consultations` | `useConsultations()` | Me |
| `POST /consultations` | `useCreateConsult()` | Book |
| `GET /notifications` | `useNotifications()` | Notifs |
| `GET /.../unread-count` | `useUnreadCount()` | Home |
| `POST /documents/upload-url` | `useGetUploadUrl()` | Docs |
| `POST /documents` | `useCreateDocument()` | Docs |
| `POST /eligibility/pre-check` | `useVisaPreCheck()` | Quiz |

## Key Patterns

- **Hooks pattern**: All API calls go through React
  Query custom hooks in `src/hooks/`. Mutations
  invalidate related query keys.
- **Type definitions**: `src/types/` mirrors backend
  types but uses `string` for dates instead of
  Firestore `Timestamp`.
- **Themed components**: Use `Screen`, `Section`,
  `Card`, `Button`, `Input` from
  `@/components/ui/themed` for consistent styling.
- **Theme hook**: `useTheme()` from
  `@/hooks/useTheme` provides `isDark`, `colors`,
  and `cn()` helper for conditional classes.
- **Error boundary**: `ErrorBoundary` component wraps
  the root layout to catch render errors.
- **Analytics**: Track screen views and key events via
  `@/services/analytics.service.ts`.

## Conventions

- **Path alias**: `@/*` maps to `./src/*`
- **Styling**: TailwindCSS via NativeWind, mobile-first
- **Icons**: `lucide-react-native` for all icons
- **Colors**: Blue-600 (#2563eb) primary, light/dark
- **Dates**: `date-fns` for formatting
- **File naming**: PascalCase for components,
  camelCase for hooks/services/utils

## Environment Variables

```bash
EXPO_PUBLIC_API_URL=http://localhost:5001/japa-platform/us-central1/api
EXPO_TOKEN=<for EAS builds>
```

## Testing with Seed Data

Backend seed creates test client users for mobile
testing:

- `john.doe@example.com` / `password123` --
  has applications (under_review)
- `jane.smith@example.com` / `password123` --
  has applications (pending_documents)
- `ahmed.ali@example.com` / `password123` --
  has applications (approved)
- `tunde.bakare@example.com` / `password123` --
  has applications (pending_payment)

Run `npm run seed:portal` in japa-backend to populate
test data.
