# TODO

## Before release

- [x] Configure React Native Firebase
- [] Set ONBOARDING_STATUS_KEY to true in AsyncStorage when onboarding is completed
- [] Set ONBOARDING_STATUS_KEY to false in AsyncStorage when onboarding is reset

### Onbording page

- [] Design user details page
  - [] Add user details form
    - name
      - first name
      - last name
      - middle name
      - suffix
    - email
    - phone number
    - address
    - D.O.B
    -
  - [] Add user details validation
  - [] Add user details submission

### Upload files

- [] Design upload files page
- [] Design uploaded files view modal
- [] Design edit uploaded files page

### Passport Purchase and renewal

- [] Design passport page
- [] Design passport details page
- [] Design passport renewal page
- [] Design passport renewal payment page
- [] Design passport renewal confirmation page
- [] Design passport renewal details page
- [] Design passport renewal history
- [] Design passport type page
- [] Design passport type selection page
- [] Design passport payment page

### Agent appointments

- [] Design book agent appointment page
- [] Design appointment payment page
- [] Design appointment confirmation page
- [] Design appointment details page
- [] Design appointment history

### Today

- [] Add reschedule appointment
  - [] Confirmation page
  - [] Appointments list page
- [] appointment details page

### Someday

- [] Fix page content below view at the bottom on scroll
- [] Add a loading state to the app

### Flow outstandings

- [] Home
  - [x] Remove search bar
  - [] Hook active applications
  - [x] link quick actions
  - [] link agent card to details
  - [x] link visas view all
  - [] link visa card to details
  - [] link destinations to available visas filtered for that country
  - [] Wire notification icon
  - [] Fix scrolling
  - [] Fix footer tab background color
  - [] Fix margin atop footer tab
  - [] Fix safe area view display
- [] Apply
  - [x] Fix search bar highlighting
  - [] Wire search bar
  - [] Wire category filters
  - [] Remove View all
  - [] Fix country flag not displaying
  - [] Enable hovering over curators to show clickable curator details
  - [] Visa details page
    - [x] is abit messy, clean it up with more white space and some colors
    - [x] Fix scrolling
    - [] Visa details header should be sticky while scrolling
  - [] Self service view should display
    - [] selected visa name
    - [] how long it will take
    - [] Allow selecting a future date greater than estimated processing time
    - [] Users should selected start application before seeing upload buttons
    - [] Each document section should show deadline
    - [] Disable upload button for each uploaded document
    - [] Uploaded documents preview is not displaying pdf
    - [] Fix scrolling
- [] Me
  - [] Include aggregation of requests, account balance, etc.
  -

## Quick actions

- [] Remove outlines to see if look is closer to mobile

---

## Authorization & subscription gating — Manual / Ops (RBAC + entitlements)

Code is done and typechecks/lints clean. The app reads `GET /users/me/authorization`, rebuilds the CASL
ability, and gates features via `useAuthorization` / `useFeature` + `<FeatureGate>`. These items need
**human action**:

### Private package access — EAS build secret
`.npmrc` is committed (reads `${NODE_AUTH_TOKEN}`). EAS cloud builds run `npm install` without your local
token, so they can't fetch the private `@durin-tech/authz` until the secret exists.
- [] Create / reuse the **read-only** GitHub Packages token (fine-grained PAT, DURIN-TECH → Packages:
     read-only — same token across services; NOT a personal PAT).
- [] `eas secret:create --name NODE_AUTH_TOKEN --value <token>` (or via the EAS dashboard). Confirm the
     EAS build resolves `@durin-tech/authz`.

### App-to-web purchase (paywall)
Subscriptions are bought on the **web portal** (Paystack), not via App/Play IAP — the app just reads the
resulting entitlement.
- [] Replace the placeholder URL `https://seli.app/upgrade` in `src/components/auth/FeatureGate.tsx` with the
     real upgrade page once it exists.
- [] Before release, re-check current App Store / Play rules on linking out to web purchases (policy is
     evolving in 2026).

### Verify
- [] `eas build` (with the secret), then confirm a gated action (e.g. the consultation-booking card on the
     agent screen) shows the paywall when the plan lacks the feature and works when it does.

> Backend is authoritative — this is UI gating only. Safe-rollout: ungated until the user has an
> entitlements doc, so nothing paywalls before plans are seeded/assigned.
