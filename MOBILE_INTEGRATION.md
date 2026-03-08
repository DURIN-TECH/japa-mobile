# Mobile App Integration Tracker

> Tracks the integration of japa-mobile with the
> backend API. Each feature below notes its status,
> the files involved, and the endpoints used. Any
> agent can resume this work.

## Integration Overview

| Area | Status | Notes |
| ---- | ------ | ----- |
| Auth & Onboarding | Mostly Done | Visa: mock |
| Home Screen | Done | Agents, notifs |
| Browse Visas | Done | Search, filter |
| Visa Details | Done | Quiz, modes |
| Agents List | Done | Search, stats |
| Agent Detail | Done | Reviews, specs |
| Book Consultation | Done | Full flow |
| Visa Service Detail | Done | Agent visa info |
| Self-Service Apps | Done | Docs, progress |
| Applications List | Done | Status filter |
| Application Detail | Done | Timeline, docs |
| Consultations List | Done | Tab filtering |
| Consultation Detail | Done | Cancel, links |
| Notifications Hook | Done | CRUD + polling |
| Error Boundary | Done | Root layout |
| Analytics | Done | Firebase |
| Seed Data | Done | 10 notifs added |

---

## Completed Features

### 1. Error Boundary

- **Files:** `src/components/ErrorBoundary.tsx`,
  `src/app/_layout.tsx`
- **Description:** React class component wrapping the
  entire app tree. Catches render errors, shows retry
  UI, reports to analytics.

### 2. Firebase Analytics

- **Files:** `src/services/analytics.service.ts`
- **Package:** `@react-native-firebase/analytics`
- **Events tracked:** screen views, login, signup,
  application created/status change, consultation
  booked, document uploaded, eligibility check,
  agent viewed, visa viewed, onboarding steps,
  search, errors
- **Pattern:**
  `analyticsService.trackEventName({ ...params })`
  -- all methods wrapped in try/catch so failures
  never crash the app.

### 3. Agents Screens (List + Detail + Visa Service)

- **Files:**
  - `src/app/(tabs)/apply/agents/index.tsx`
  - `src/app/(tabs)/apply/agents/[id].tsx`
  - `src/app/(tabs)/apply/agents/[id]/visa-service/[type].tsx`
- **Hook:** `src/hooks/useAgents.ts`
- **Endpoints:** `GET /agents`, `GET /agents/top`,
  `GET /agents/:id`, `GET /agents/visa/:visaTypeId`
- **Adapter:** `formatAgentForDisplay(apiAgent)`
  converts `ApiAgent` to legacy display format with
  `initials`, `price` (cents to display string),
  `verificationCount`
- **Changes:** Replaced `verificationAgents` mock
  array with `useAgent()`/`useAgents()` hooks. Added
  loading/empty states, search, analytics.

### 4. Consultations (List + Detail + Booking)

- **Files:**
  - `src/app/(tabs)/me/consultations/index.tsx`
  - `src/app/(tabs)/me/consultations/[id].tsx`
  - `src/app/(tabs)/apply/agents/[id]/book-consultation.tsx`
  - `src/app/(tabs)/apply/agents/[id]/payment.tsx`
  - `src/app/(tabs)/apply/agents/[id]/confirmation.tsx`
  - `src/components/consultations/ConsultationCard.tsx`
- **Hook:** `src/hooks/useConsultations.ts`
- **Endpoints:** `GET /consultations`,
  `GET /consultations/:id`, `POST /consultations`,
  `PUT /consultations/:id/status`
- **Type mapping:** Backend has 7 statuses
  (`pending_payment`, `scheduled`, `confirmed`,
  `in_progress`, `completed`, `cancelled`,
  `no_show`) mapped to 3 display statuses
  (`upcoming`, `completed`, `cancelled`) via
  `getConsultationDisplayStatus()`.
- **Changes:** Replaced `mockConsultations` with API
  hooks, payment screen creates real consultations
  via POST, cancel calls PUT with
  `{status:'cancelled'}`.

### 5. Home Screen

- **File:** `src/app/(tabs)/index.tsx`
- **Endpoints:** `GET /agents/top?limit=3`,
  `GET /applications`,
  `GET /notifications/unread-count`
- **Changes:** Top agents from `useTopAgents(3)` +
  `formatAgentForDisplay()`, active application from
  `useApplications()` (finds first in-progress),
  notification bell badge from
  `useUnreadNotificationCount()` (polls every 30s).

### 6. Me Screen (Dashboard)

- **File:** `src/app/(tabs)/me/index.tsx`
- **Endpoints:** `GET /applications`,
  `GET /consultations`
- **Changes:** Replaced `mockConsultations` import
  with `useConsultations()`. Pull-to-refresh
  invalidates both queries. Added analytics screen
  tracking.

### 7. Notifications Hook

- **File:** `src/hooks/useNotifications.ts`
- **Endpoints:** `GET /notifications`,
  `GET /notifications/unread-count`,
  `PUT /notifications/:id/read`,
  `PUT /notifications/read-all`
- **Features:** `useUnreadNotificationCount()` polls
  every 30s. Mutations invalidate both count and
  list queries.

### 8. Seed Data Updates

- **File:**
  `japa-backend/.../seed-portal-data.ts`
- **Added:** 10 client-facing notifications
  (seed-notif-013 through seed-notif-022) for users:
  John Doe, Jane Smith, Ahmed Ali, Tunde Bakare,
  Kwame Asante, Sipho Ndlovu
- **Notification types covered:**
  `application_update`, `document_status`, `system`,
  `payment_received`, `consultation_reminder`
- **Existing:** 8 consultations linked to client
  users, 14 applications, documents, timelines --
  all sufficient for mobile testing

### 9. Already-Integrated Screens (pre-existing)

These were already wired to API before this
integration pass:

- **Apply/Browse**
  (`src/app/(tabs)/apply/index.tsx`) --
  `useVisaTypes()`, `useVisaSearch()`,
  `useCountriesWithVisas()`
- **Visa Details**
  (`src/app/(tabs)/apply/visa-details/[id].tsx`) --
  `useVisaType()`, `useCreateApplication()`
- **Self-Service**
  (`src/app/(tabs)/apply/self-service/[id].tsx`) --
  full document upload flow
- **Application Detail**
  (`src/app/(tabs)/me/applications/[id].tsx`) --
  `useApplication()`, `useApplicationTimeline()`
- **Onboarding Country**
  (`src/app/(onboard)/country.tsx`) --
  `useCountries(true)`

---

## Remaining Work

### 1. ~~Onboarding Visa Selection Screen~~ (Not needed)

- **File:** `src/(onboard)/visa.tsx` -- this is an
  OLD file outside `src/app/`, not an active route
- The active onboarding flow is `src/app/(onboard)/`
  with steps: passport, country, personal-info,
  complete
- The visa selection screen was removed from the
  onboarding flow; no integration needed

### 2. Notification UI Screens

- **Status:** Hook exists (`useNotifications.ts`)
  but no dedicated notification list screen found
- **Needed:** A notifications screen (likely at
  `src/app/(tabs)/notifications/index.tsx` or
  similar) that renders the notification list with
  read/unread states, mark-as-read actions, and
  navigation to related entities
- **The hook provides:** `useNotifications(limit)`,
  `useMarkNotificationRead()`,
  `useMarkAllNotificationsRead()`

### 3. Messaging / Chat Screen

- **Status:** Backend has conversations + messages
  seeded, but no mobile chat UI found
- **Endpoints available:** Would need
  `GET /conversations`,
  `GET /conversations/:id/messages`,
  `POST /conversations/:id/messages`
- **Priority:** Lower -- major feature addition,
  not just wiring existing screens

### 4. Settings Screen API Integration

- **File:** `src/app/(tabs)/me/settings/index.tsx`
  (if exists)
- **Status:** Likely uses Zustand stores for
  theme/language (client-side only). May not need
  backend integration unless profile editing is
  added.

---

## Key Patterns for Resuming Work

### Adding a new API hook

```typescript
// src/hooks/useFeature.ts
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  apiService,
} from '@/services/api.service';

export function useFeature(id: string) {
  return useQuery({
    queryKey: ['features', id],
    queryFn: () =>
      apiService
        .get(`/features/${id}`)
        .then((r) => r.data.data),
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
```

### Replacing mock data in a screen

1. Import the hook instead of mock data:
   `import { useFeature } from '@/hooks/useFeature';`
2. Call the hook:
   `const { data, isLoading } = useFeature(id);`
3. Add loading state (use `<ActivityIndicator>`)
4. Add empty/error state
5. Remove old mock import

### Type conversion pattern

When API returns different shapes than legacy UI
expects:

```typescript
export function formatForDisplay(
  apiItem: ApiType,
): LegacyType {
  return {
    id: apiItem.id,
    name: apiItem.displayName,
    price: `$${Math.round(apiItem.feeCents / 100)}`,
    // ... map fields
  };
}
```

### Analytics tracking

```typescript
import {
  analyticsService,
} from '@/services/analytics.service';

analyticsService.trackScreenView('ScreenName');
analyticsService.trackEventName({ param1: 'value' });
```

---

## Test Accounts (Seed Data)

All passwords: `password123`

| Email | Data |
| ----- | ---- |
| `john.doe@example.com` | 1 app (under_review), 1 consult, 3 notifs |
| `jane.smith@example.com` | 1 app (pending_docs), 1 consult, 2 notifs |
| `ahmed.ali@example.com` | 1 app (approved), 1 consult, 1 notif |
| `tunde.bakare@example.com` | 1 app (pending_pay), 1 notif |
| `kwame.asante@example.com` | 1 app (draft), 1 self-svc, 1 consult, 1 notif |
| `sipho.ndlovu@example.com` | 1 app (interview), 1 self-svc, 1 consult, 2 ntf |
| `lisa.wong@example.com` | 1 app (rejected), 1 no-show consult |
| `wanjiku.mwangi@example.com` | 1 app (submitted), 1 self-svc, 1 consult |
| `priya.sharma@example.com` | 1 app (withdrawn), 1 self-svc, 1 consult |
| `miguel.santos@example.com` | 1 app (expired) |

Run `npm run seed:portal` in japa-backend to populate
all test data.

---

## Files Modified in This Integration

| File | Change |
| ---- | ------ |
| `CLAUDE.md` | Created |
| `ErrorBoundary.tsx` | Created |
| `analytics.service.ts` | Created |
| `useAgents.ts` | Created |
| `useConsultations.ts` | Rewritten |
| `useNotifications.ts` | Created |
| `_layout.tsx` | ErrorBoundary |
| `(tabs)/index.tsx` | Real data |
| `agents/index.tsx` | API agents |
| `agents/[id].tsx` | API detail |
| `book-consultation.tsx` | API agent |
| `payment.tsx` | Real consult |
| `confirmation.tsx` | API agent |
| `visa-service/[type].tsx` | API agent |
| `me/index.tsx` | API consults |
| `consultations/[id].tsx` | API + cancel |
| `ConsultationCard.tsx` | API type |
| `seed-portal-data.ts` | Notifs added |
