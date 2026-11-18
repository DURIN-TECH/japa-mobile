// ─────────────────────────────────────────────────────────────────────────────
// Developer configuration snapshot (japa#330).
//
// Builds the list of "what is this running app actually using" rows shown on
// the dev-only /dev-config screen. Split in two so the logic is testable
// without native modules:
//
//   • `buildDevConfigSections(sources)` — PURE. Takes plain values, returns
//     labelled sections. All formatting / fallbacks live here.
//   • `collectDevConfigSources()` (in devConfigCollect.ts) — reads the live
//     values from expo-constants, expo-updates, Firebase, react-native. Kept in
//     its own file so this one has no native imports and stays unit-testable.
//
// SECURITY: this never surfaces secrets. ID tokens are reduced to their
// expiry time; only public identifiers (project id, app id, uid, email, role
// claim) are shown. The screen itself is gated to non-production builds.
// ─────────────────────────────────────────────────────────────────────────────

// ── Plain input values (everything the pure builder needs) ───────────────────
export type DevConfigSources = {
  appEnv: string;
  apiUrl: string;
  firebaseProjectId: string; // the project the app CONFIG expects
  nativeFirebaseProjectId?: string; // the project the native Firebase app was initialised with
  nativeFirebaseAppId?: string;
  useEmulator: boolean;
  emulatorHost: string;
  emulatorProjectId: string;
  feedbackEnabled: boolean;
  // Self-service-only flag (japa#375): the effective value, where it comes
  // from (the build, or the dev-only override), and the build's own value.
  // Optional so older callers / fixtures still type-check.
  selfServiceOnly?: boolean;
  selfServiceOnlySource?: 'build' | 'override';
  selfServiceOnlyBuild?: boolean;
  appVersion?: string;
  buildNumber?: string;
  bundleId?: string;
  updatesEnabled?: boolean;
  updateChannel?: string | null;
  runtimeVersion?: string | null;
  updateId?: string | null;
  isEmbeddedLaunch?: boolean;
  bundleSource?: string; // Metro URL or "embedded"
  isDevBuild: boolean; // __DEV__
  os: string;
  osVersion: string;
  deviceName?: string;
  user?: {
    uid: string;
    email?: string | null;
    emailVerified?: boolean;
    role?: string | null;
    tokenExpiresAt?: string | null; // ISO string
  } | null;
};

export type DevConfigRow = { label: string; value: string; warn?: boolean };
export type DevConfigSection = { title: string; rows: DevConfigRow[] };

const NA = 'unavailable';
const show = (v: string | null | undefined, fallback = NA) =>
  v === undefined || v === null || v === '' ? fallback : String(v);
const yesNo = (b: boolean | undefined) =>
  b === undefined ? NA : b ? 'yes' : 'no';

// ── Pure builder ─────────────────────────────────────────────────────────────
export function buildDevConfigSections(
  s: DevConfigSources,
  now: Date = new Date(),
): DevConfigSection[] {
  // A mismatch between the project the config expects and the one the native
  // Firebase app actually booted with means every authenticated call will 401 —
  // the most common "why is nothing loading" cause, so flag it loudly.
  const projectMismatch =
    !!s.nativeFirebaseProjectId &&
    s.nativeFirebaseProjectId !== s.firebaseProjectId;

  const environment: DevConfigSection = {
    title: 'Environment',
    rows: [
      { label: 'App environment', value: s.appEnv },
      { label: 'API server', value: s.apiUrl },
      { label: 'Firebase project (config)', value: s.firebaseProjectId },
      {
        label: 'Firebase project (native)',
        value: show(s.nativeFirebaseProjectId),
        warn: projectMismatch,
      },
      { label: 'Firebase app id', value: show(s.nativeFirebaseAppId) },
      {
        label: 'Local emulators',
        value: s.useEmulator
          ? `on · ${s.emulatorHost} · ${s.emulatorProjectId}`
          : 'off',
      },
      { label: 'Feedback button', value: s.feedbackEnabled ? 'on' : 'off' },
      // japa#375: e.g. "on · override (build: off)" or "off · build".
      {
        label: 'Self-service only',
        value:
          s.selfServiceOnly === undefined
            ? NA
            : `${s.selfServiceOnly ? 'on' : 'off'} · ${
                s.selfServiceOnlySource === 'override'
                  ? `override (build: ${s.selfServiceOnlyBuild ? 'on' : 'off'})`
                  : 'build'
              }`,
      },
    ],
  };

  // Updates: an embedded launch means the JS shipped inside the binary is
  // running; otherwise an EAS Update was downloaded and is running.
  const updateRunning = !s.updatesEnabled
    ? 'updates off'
    : s.isEmbeddedLaunch
      ? 'embedded (no update)'
      : show(s.updateId);

  const build: DevConfigSection = {
    title: 'Build',
    rows: [
      { label: 'Version', value: show(s.appVersion) },
      { label: 'Build number', value: show(s.buildNumber) },
      { label: 'Bundle id', value: show(s.bundleId) },
      { label: 'JS bundle from', value: show(s.bundleSource) },
      { label: 'Dev mode (__DEV__)', value: yesNo(s.isDevBuild) },
      { label: 'Update channel', value: show(s.updateChannel, 'none') },
      { label: 'Runtime version', value: show(s.runtimeVersion) },
      { label: 'Running update', value: updateRunning },
    ],
  };

  // Token expiry: show the time plus how long is left, and flag if expired.
  let tokenValue = NA;
  let tokenExpired = false;
  if (s.user?.tokenExpiresAt) {
    const exp = new Date(s.user.tokenExpiresAt);
    const mins = Math.round((exp.getTime() - now.getTime()) / 60000);
    tokenExpired = mins <= 0;
    tokenValue = `${exp.toLocaleTimeString()} (${
      tokenExpired ? 'expired' : `in ${mins} min`
    })`;
  }

  const account: DevConfigSection = {
    title: 'Signed in as',
    rows: s.user
      ? [
          { label: 'User id', value: s.user.uid },
          { label: 'Email', value: show(s.user.email, 'none') },
          { label: 'Email verified', value: yesNo(s.user.emailVerified) },
          // Role comes from the token's custom claims (what the backend sees).
          { label: 'Role (token)', value: show(s.user.role, 'none') },
          { label: 'Token expires', value: tokenValue, warn: tokenExpired },
        ]
      : [{ label: 'User', value: 'not signed in' }],
  };

  const device: DevConfigSection = {
    title: 'Device',
    rows: [
      { label: 'OS', value: `${s.os} ${s.osVersion}` },
      { label: 'Device', value: show(s.deviceName) },
    ],
  };

  return [environment, build, account, device];
}

// ── Plain-text form for the Share/copy action (paste into a bug report) ──────
export function devConfigToText(sections: DevConfigSection[]): string {
  return sections
    .map(
      (sec) =>
        `## ${sec.title}\n` +
        sec.rows
          .map((r) => `${r.label}: ${r.value}${r.warn ? '  ⚠️' : ''}`)
          .join('\n'),
    )
    .join('\n\n');
}
