# Maestro end-to-end suite (seli-mobile)

Scripted end-to-end checks for the mobile app (DURIN-TECH/japa#361). One
command runs them against the local Firebase emulators and a seed: no AI
usage, no payments, nothing written to `durin-seli-dev` or `japa-platform`.

This suite is how mobile e2e is done:

- a mobile UI feature adds or extends a tagged flow here in the same build,
  with the `testID`s it needs;
- QA runs the flows that cover what an issue touched (a targeted run), and
  only walks by hand (or with an agent) what no flow covers yet.

## Contents

- [Prerequisites](#prerequisites)
- [Running](#running)
- [Flows and tags](#flows-and-tags)
- [Adding a flow and testIDs](#adding-a-flow-and-testids)
- [The no-AI / no-payment rule](#the-no-ai--no-payment-rule)
- [Safety model](#safety-model)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Install with the official methods only (no `sudo`, no unofficial taps).

- **Maestro CLI** (installed and measured with **2.12.1**):

  ```bash
  brew tap mobile-dev-inc/tap && brew install mobile-dev-inc/tap/maestro
  # or the official script:
  curl -fsSL "https://get.maestro.mobile.dev" | bash
  ```

- **Java 17 or newer** from an official distribution:
  `brew install openjdk@21` (follow brew's PATH note) or Eclipse Temurin
  from <https://adoptium.net>. The Maestro formula also pulls Homebrew's
  `openjdk`.
- **Xcode** with an iOS simulator runtime, and the **Firebase CLI**
  (`npm install -g firebase-tools`).
- A **`seli-backend` checkout** with the e2e set-up (`firebase.e2e.json`,
  `npm run seed:e2e`; see its `docs/e2e-emulators.md`). Default: the sibling
  folder `../seli-backend`; otherwise `--backend <path>` or
  `SELI_E2E_BACKEND`. Its `functions/node_modules` must be installed.
- **The dev client** (`com.durintech.japamobile`, an `ios-simulator` /
  development build). The runner finds it by itself on another simulator and
  only reads it there; or pass `--app <path/to/Seli.app>` (from
  `eas build --profile ios-simulator` or `npx expo run:ios`). It needs a
  build that includes the japa#375 development link.

The runner checks Maestro, Java, the Firebase CLI and `xcrun` first and
prints these install commands when one is missing.

## Running

```bash
npm run e2e                                         # the whole suite
npm run e2e -- --tags auth                          # flows with ANY of the tags
npm run e2e -- --tags self-service,flag-on
npm run e2e -- --flow .maestro/flows/auth/sign-in.yaml   # one file (repeatable)
npm run e2e -- --list                               # list flows + tags, run nothing
```

Options (each also an environment variable): `--backend` /
`SELI_E2E_BACKEND`, `--app` / `SELI_E2E_APP`, `--port` /
`SELI_E2E_METRO_PORT` (Metro; default the first free port from 8090),
`--out` / `SELI_E2E_OUT` (default `<os tmp>/seli-e2e/<run id>`), and
`--device-type` / `SELI_E2E_DEVICE_TYPE` (default `iPhone 17`).

What one run does:

1. checks the tools, then the flows' tags, and selects the flows;
2. checks every emulator port in `seli-backend/firebase.e2e.json` and the
   Metro port are free (stops naming a taken one);
3. cuts off real access (see [Safety model](#safety-model)), builds the
   functions, starts the emulators (functions, firestore, auth, storage,
   pubsub) under `durin-seli-dev` with empty data, and seeds them (full seed
   plus the e2e fixture);
4. creates its own simulator **`Seli E2E <id>`** (headless, no Simulator
   window), installs the dev client, pre-approves its URL schemes and turns
   off the dev menu's launch sheets;
5. starts Metro with `EXPO_PUBLIC_USE_EMULATOR=true`,
   `EXPO_PUBLIC_EMULATOR_PROJECT_ID=durin-seli-dev` and the e2e Auth /
   Functions ports (`EXPO_PUBLIC_EMULATOR_AUTH_PORT` /
   `EXPO_PUBLIC_EMULATOR_FUNCTIONS_PORT`), checks the manifest it serves,
   opens the dev client on it and waits for the **`iOS Bundled`** line in its
   own Metro log;
6. **preflight** (`support/preflight.yaml`): signs in and reads the in-app
   App configuration screen; the running bundle's API server must be the
   local Functions emulator and the signed-in user the emulator-only fixture user;
7. runs the selected flows with Maestro on its simulator **by UDID**;
8. sets the flag back to the build's value (`support/restore-flag.yaml`),
   prints a per-flow summary (flow, flag state, PASS/FAIL, duration) and
   the output folder (logs, JUnit report, Maestro screenshots and debug
   output of failed flows);
9. tears down Metro, the emulators, the simulator and the temp files (also on
   failure and Ctrl-C) and checks its ports are free again.

Exit code 0 = every selected flow passed; 1 = a flow or a run step failed;
2 = a set-up problem found before anything started; 130 = interrupted.

The runner's own unit tests: `npm run test:e2e-runner`.

**Measured duration** (this machine, 2026-11-16): see
[Measured runs](#measured-runs).

### Measured runs

Filled in from three consecutive full runs (`npm run e2e`) on the machine
the suite was built on. Most of a run is set-up (functions build, emulators,
seed, simulator, first bundle); the flows themselves are the "suite" time.

| Run | Suite (flows) | Wall clock | Result |
| --- | --- | --- | --- |
| 1 | – | – | – |
| 2 | – | – | – |
| 3 | – | – | – |

## Flows and tags

```text
.maestro/
  flows/          suite flows, one YAML file per flow (unique file names)
    auth/         sign-in.yaml, sign-in-wrong-password.yaml
    self-service/ journey-flag-on.yaml, journey-flag-off.yaml, date-picker.yaml,
                  open-document.yaml, tracker-pull-refresh.yaml
    flag/         flag-on.yaml, flag-off.yaml
    booking/      future-day-times.yaml
  subflows/       shared steps (launch, sign-in, sign-out, flag switches, ...)
  support/        runner-only: preflight.yaml, restore-flag.yaml, scripts/
```

Every flow has at least one **area tag** (`auth`, `self-service`, `flag`,
`booking`)
and exactly one **flag tag**:

| Flag tag | Meaning |
| --- | --- |
| `flag-on` | needs the self-service-only flag on; the flow switches it on itself |
| `flag-off` | needs it off; the flow switches it off itself |
| `flag-any` | works in either state |

The runner refuses to start when a flow breaks this rule, so a mis-tagged
flow cannot silently drop out of a targeted run.

**One Metro pass.** The bundle is built once with the flag off; the flag
flows switch it with the development-only link from japa#375,
`durintech://dev/self-service-only?value=on|off|build`, while the app is
already running (a warm link), then wait for the real end state (the Agents
tab gone or back, and Home on screen), never a fixed time. A same-value link
applies without a reload. The suite ends with `value=build`. Flows are
order-independent.

| Flow | Covers |
| --- | --- |
| `auth/sign-in` | welcome → Log in → email + password → Home |
| `auth/sign-in-wrong-password` | wrong password → "Login failed" + inline error, stays on Log in |
| `self-service/journey-flag-on` / `-flag-off` | as the fixture client: Explore → Ireland Short Stay 'C' → Self-service → new application's hub → intake (answer all, save) → intake card answered → documents step lists "Passport" and "Proof of accommodation" → review screen (by link) shows "See how ready you are" with "Review my application" (not tapped) |
| `self-service/date-picker` | the shared date picker (japa#407) on Holdings › Add document › Valid until (by link): a day tap sets the date and closes the calendar; a field tap closes it unchanged; Done keeps the highlighted day and closes. No From/To pair: the e2e fixture has no date question |
| `self-service/open-document` | as John Doe (flag any): tap the seeded passport document on `seed-app-001`'s hub → its error line (`doc-row-<id>-error`, the seed's placeholder file answers 409) with the "can't be opened" copy; tap again → error again; same row on My documents → error line (japa#446). The viewer itself is a walk |
| `self-service/tracker-pull-refresh` | as John Doe (flag any): Tracker lists `tracker.row.seed-app-001`; back to the top, a real pull-down gesture; still on the Tracker with the same row (japa#474: a pull keeps the rows while it refetches) |
| `flag/flag-on` | as John Doe: 4 tabs; the 14 hidden deep links from Tracker end on Home and a swipe-back stays there; `/subscription`, `/notifications`, `/self-service/seed-app-001` open; Home without Messages / "Find an agent"; Destination without "Work with an agent" / Top agents; `seed-app-001` without message button / Payment requests; Profile without the four agent rows and the Agents stat; Settings without Privacy |
| `booking/future-day-times` | as the fixture client, flag off: `durintech://book/seed-agent-001` → the today chip (`book.day.0`) is in the strip; on tomorrow (`book.day.1`) all 17 time pills (`book.time.0`-`16`) are enabled and "No times left today" is absent; 9:00 AM + a topic enables Continue (`book.continue`, not tapped). Clock-independent; the started-pill rule for today is unit-tested (japa#472) |
| `flag/flag-off` | as John Doe: 5 tabs; Home Messages + "Find an agent"; `durintech://messages` opens Messages; `seed-app-001` message button + Payment requests; Destination "Work with an agent"; Profile's four rows and Agents stat; Settings Privacy |

Accounts are emulator-only seed / fixture users, passed in by the runner
(`E2E_EMAIL` = `delivered+e2e.amaka.obi@resend.dev`, `FLAG_EMAIL` =
`delivered+john.doe@resend.dev`, `PASSWORD` = the seed password read from
`seli-backend`). None is a real account.

## Adding a flow and testIDs

1. Put the file under `flows/<area>/`, with a unique file name and the tags
   in its config section:

   ```yaml
   appId: ${APP_ID}
   tags:
     - self-service
     - flag-any
   ---
   - runFlow:
       file: ../../subflows/sign-in.yaml
       env:
         EMAIL: ${E2E_EMAIL}
   - ...
   ```

2. Start from `subflows/sign-in.yaml` (it relaunches the dev client) or
   `subflows/launch.yaml`. A `flag-on` / `flag-off` flow runs
   `subflows/flag-on.yaml` / `flag-off.yaml` right after signing in.
3. Tap and assert by **`id:`** (a `testID`). Match text only for copy the
   flow is checking. Ids are regexes in Maestro: escape dots
   (`"screen\\.home"`).
4. Add the `testID`s the flow needs, on the element it taps or asserts on (on
   iOS a `Pressable` hides its children's ids, so put the id on the
   `Pressable` itself). Namespaced and stable: `screen.<name>` for a screen's
   root, `<screen>.<thing>` inside it (`home.messages`, `tab.agents`,
   `profile.row.payments`, `intake.q.<questionId>.option.<value>`). A
   `testID` changes nothing visible; shared components take an optional
   `testID` prop.
5. Wait on real conditions (`extendedWaitUntil` on an id), never fixed
   sleeps. Open app links only once the app is up: a cold start through a
   link is not routed by the iOS dev client (japa#375 / #371).
6. Run it alone (`npm run e2e -- --flow <file>`), then the whole suite.

## The no-AI / no-payment rule

**No flow taps anything that starts an AI review or a payment.** Never tap:

- `selfService.reviewCta` (the hub's sticky review button) or `review.start`
  ("Review my application");
- "Check my application" / "Run my review" / re-run controls on any review
  screen;
- anything on `/subscription`, `/pay`, `/payments` that starts a checkout,
  or any payment-request approve / pay button.

Flows may assert these are present. Reviewers check every flow against this
list; this grep must print nothing:

```bash
grep -rnE -A1 --include='*.yaml' 'tapOn' .maestro | grep -E 'reviewCta|review\\.start|Review my application|checkout|Pay |Subscribe|Upgrade'
```

## Safety model

The emulators run under the **real dev project id `durin-seli-dev`**: the
simulator dev client's native Firebase config mints Auth-emulator tokens for
that id, and a `demo-*` id answers 401. So the runner cuts off real access
before anything starts, and refuses to start otherwise:

- `seli-backend/functions/.secret.local` must hold the runner's dummy value
  (`seli-e2e-dummy-not-a-secret`) for **every** secret the built functions
  declare. Missing → the runner writes it and removes it at the end. Present
  with any other value → it stops and never overwrites it.
- The emulators and the seed get a clean environment (an allow-list; no
  inherited `FIREBASE_TOKEN`, `GOOGLE_*` or API keys) with
  `GOOGLE_APPLICATION_CREDENTIALS` = a throwaway service account whose
  `token_uri` is an unreachable local port, and empty temp
  `CLOUDSDK_CONFIG` / `XDG_CONFIG_HOME`.
- The seed's outbound HTTP(S) goes to a dead local proxy
  (`NODE_USE_ENV_PROXY=1`); localhost is exempt. The emulators cannot get
  this: firebase-tools sends every request through `HTTPS_PROXY` and ignores
  `NO_PROXY`, so its calls to the local Firestore emulator fail. For the
  functions the dummy secrets and fake credentials are the cut-off, and no
  flow triggers an AI review, a payment or an email.
- `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST` and
  `FIREBASE_STORAGE_EMULATOR_HOST` must be local before the seed runs (the
  backend's `seed:e2e` guard checks again).
- No functions env file may set `EMAIL_SENDING_ENABLED`.
- Metro runs with `EXPO_OFFLINE=1`; the app's config is checked in the
  manifest and again in the running app (preflight).
- Ports: Metro never on 8081-8083 or a taken port (8084-8089 are QA walks);
  emulators only on the `firebase.e2e.json` block; nothing the runner did not
  start is ever stopped or reused. The simulator is the runner's own
  (`Seli E2E <id>`, with an ownership marker); other devices are only read.

Not covered by the runner: the dev client's native Firebase SDKs
(Analytics, Crashlytics, Installations, Messaging) still talk to Google for
`durin-seli-dev` from the simulator, as in any dev build. That is the
simulator's own traffic, not the backend.

**Multiple emulator suites.** While an e2e run is going, firebase-tools may
warn "multiple instances of the emulator suite for project durin-seli-dev"
if a developer also runs emulators under that id. Running emulators are not
affected, but CLI discovery commands (`firebase emulators:exec`, ...) in the
other session may find the e2e hub instead (the hub locator file is keyed by
project id). Avoid those commands while a run is going.

## Troubleshooting

- **"emulator port 196xx ... is taken"**: another e2e run is going, or one
  was killed hard. Check with `lsof -nP -iTCP:19600-19609 -sTCP:LISTEN`; stop
  only a process you know is yours.
- **"Metro port ... is in use"**: pick another with `--port`, ≥ 8090.
- **Bundle from the wrong Metro / API not local**: the runner stops at the
  manifest check or the preflight. Never point the e2e simulator at
  another session's Metro (8081-8083); those serve the deployed dev backend.
- **"functions/.secret.local exists and ... is not the runner's dummy value"**:
  it may hold real secrets. Move it out of the repo, run again.
- **No dev client found**: pass `--app <path/to/Seli.app>`.
- **"Failed to load app" on the dev client**: a known dev-client flake
  (~1 in 8 relaunches); `subflows/launch.yaml` retries the load once and the
  summary says how often it did.
- **A failed flow**: the output folder printed at the end holds
  `suite/maestro.log`, `suite/report.xml`, and per-flow screenshots and
  hierarchy dumps under `suite/artifacts` and `suite/debug`, plus
  `emulators.log`, `metro.log` and `seed.log`.
- **Leftover simulator after a hard kill** (`kill -9`): the next run removes
  `Seli E2E` devices whose run is gone; or `xcrun simctl delete <udid>`.
