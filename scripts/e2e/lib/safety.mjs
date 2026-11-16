/*
 * scripts/e2e/lib/safety.mjs — cut off real access before the e2e emulators
 * start (japa#361). Enforced, never assumed.
 *
 * WHY: the emulators must run under the REAL dev project id
 * (`durin-seli-dev`): the simulator dev client's native Firebase config mints
 * Auth-emulator tokens for that id, and a `demo-*` id answers 401. Under the
 * real id the functions emulator would happily fetch real secrets from Secret
 * Manager and the Admin SDK would use whatever Google login the machine has.
 * So, before anything starts:
 *
 *   1. `functions/.secret.local` holds the runner's dummy value for EVERY
 *      secret the functions declare (otherwise the emulator pulls the real
 *      ones). Missing → the runner writes it (and removes it at the end).
 *      Present with any other value → the runner stops; it never overwrites.
 *   2. The emulator and seed processes get a CLEAN environment built from an
 *      allow-list (no inherited FIREBASE_TOKEN, GOOGLE_*, API keys, ...), with
 *      a fake service account whose token_uri is unreachable, and empty temp
 *      CLOUDSDK_CONFIG / XDG_CONFIG_HOME (no gcloud / firebase login found).
 *   3. Belt and braces for the SEED process only (`deadProxyEnv`):
 *      HTTP(S)_PROXY points at a dead local port with NODE_USE_ENV_PROXY=1,
 *      so any outbound request Node makes there fails locally. Local hosts
 *      are exempt (NO_PROXY). NOT for the emulators: firebase-tools sends
 *      EVERY request through HTTPS_PROXY and ignores NO_PROXY (lib/apiv2.js
 *      `proxyURIFromEnv`), so its own calls to the local Firestore emulator
 *      fail and the suite does not start (seen on the first run). There the
 *      dummy secrets and the fake credentials are the cut-off.
 *   4. The three *_EMULATOR_HOST variables must point at this machine before
 *      the seed runs (the backend's own guard checks again).
 *   5. No functions env file the emulator loads may switch local email on
 *      (EMAIL_SENDING_ENABLED).
 *
 * Pure helpers are unit-tested in scripts/e2e/__tests__/safety.test.mjs.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const PROJECT_ID = 'durin-seli-dev';

/** The runner's placeholder. Any other value in .secret.local stops a run. */
export const DUMMY_SECRET = 'seli-e2e-dummy-not-a-secret';

/** A port nothing listens on: the dead proxy and the fake token_uri. */
export const DEAD_PORT = 9;

/** Hosts that must never go through the dead proxy. */
export const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

/** KEY=VALUE lines of a dotenv-style file (comments and blanks ignored). */
export function parseEnvFile(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

/**
 * What to do about `functions/.secret.local`.
 *   existing: the file's text, or null when it does not exist
 *   declared: every secret name the functions declare
 * → { action: 'write' }                       file missing: create it
 *   { action: 'reuse' }                       ours: every declared secret, all dummy
 *   { action: 'refuse', reason }              anything else (never overwritten)
 */
export function planSecretFile(existing, declared) {
  if (existing === null) return { action: 'write' };
  const vals = parseEnvFile(existing);
  const notDummy = Object.entries(vals)
    .filter(([, v]) => v !== DUMMY_SECRET)
    .map(([k]) => k);
  if (notDummy.length) {
    return {
      action: 'refuse',
      reason:
        `functions/.secret.local exists and ${notDummy.join(', ')} ` +
        `${notDummy.length === 1 ? 'is' : 'are'} not the runner's dummy value. ` +
        'It may hold real secrets, so the runner will not use or overwrite it. ' +
        'Move it aside (keep it outside the repo) and run again.',
    };
  }
  const missing = declared.filter((k) => !(k in vals));
  if (missing.length) {
    return {
      action: 'refuse',
      reason:
        `functions/.secret.local has no dummy value for ${missing.join(', ')}; ` +
        'the emulator would fetch the real one. Delete the file (it only ' +
        'holds dummies) and the runner writes a complete one.',
    };
  }
  return { action: 'reuse' };
}

/** The .secret.local the runner writes: one dummy line per declared secret. */
export function secretFileContent(declared) {
  return (
    '# Written by seli-mobile scripts/e2e (japa#361): DUMMY values only, so the\n' +
    '# functions emulator never fetches real secrets. Removed after the run.\n' +
    declared.map((k) => `${k}=${DUMMY_SECRET}`).join('\n') +
    '\n'
  );
}

/** True for "localhost:<port>" / "127.0.0.1:<port>" (an http:// prefix is ok). */
export function isLocalHostPort(value) {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1):\d{1,5}$/.test(
    String(value ?? ''),
  );
}

/** Throws unless every given *_EMULATOR_HOST is set and local. */
export function assertEmulatorHosts(env) {
  const names = [
    'FIRESTORE_EMULATOR_HOST',
    'FIREBASE_AUTH_EMULATOR_HOST',
    'FIREBASE_STORAGE_EMULATOR_HOST',
  ];
  const bad = names.filter((n) => !isLocalHostPort(env[n]));
  if (bad.length) {
    throw new Error(
      `refusing to seed: ${bad.map((n) => `${n}=${env[n] ?? '(unset)'}`).join(', ')} ` +
        '(each must be localhost:<port> or 127.0.0.1:<port>)',
    );
  }
}

/**
 * Functions env files the emulator loads for this project, with a key that
 * would switch on real email. Returns ["<file>: EMAIL_SENDING_ENABLED=..."].
 */
export function emailSwitchProblems(functionsDir, project = PROJECT_ID) {
  const files = ['.env', `.env.${project}`, '.env.local'];
  const out = [];
  for (const f of files) {
    const p = path.join(functionsDir, f);
    if (!fs.existsSync(p)) continue;
    const v = parseEnvFile(fs.readFileSync(p, 'utf8')).EMAIL_SENDING_ENABLED;
    if (
      v !== undefined &&
      v.trim().toLowerCase() !== 'false' &&
      v.trim() !== ''
    ) {
      out.push(`${f}: EMAIL_SENDING_ENABLED=${v}`);
    }
  }
  return out;
}

/**
 * A throwaway service account (fresh RSA key, made-up identity) whose
 * token_uri points at a dead local port, so an Admin SDK that ever tried to
 * mint a Google token fails on this machine.
 */
export function fakeServiceAccount() {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return {
    type: 'service_account',
    project_id: PROJECT_ID,
    private_key_id: 'seli-e2e-fake',
    private_key: privateKey,
    client_email: 'seli-e2e-fake@invalid.invalid',
    client_id: '0',
    auth_uri: `http://127.0.0.1:${DEAD_PORT}/auth`,
    token_uri: `http://127.0.0.1:${DEAD_PORT}/token`,
  };
}

/** Variables passed through from the runner's own environment. */
const PASS_THROUGH = [
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'LANG',
  'LC_ALL',
  'TERM',
  'TMPDIR',
  'JAVA_HOME',
  'NVM_DIR',
  'NVM_BIN',
];

/**
 * The clean environment for the emulators and the seed.
 *   base:     the runner's environment (only PASS_THROUGH keys are kept)
 *   tmp:      { credentials, cloudsdk, xdg } paths made by the runner
 *   ports:    { firestore, auth, storage } from firebase.e2e.json
 */
export function cutOffEnv(base, tmp, ports) {
  const env = {};
  for (const k of PASS_THROUGH) if (base[k] !== undefined) env[k] = base[k];
  Object.assign(env, {
    // Fake identity + no gcloud / firebase login.
    GOOGLE_APPLICATION_CREDENTIALS: tmp.credentials,
    CLOUDSDK_CONFIG: tmp.cloudsdk,
    XDG_CONFIG_HOME: tmp.xdg,
    // The project, named the same everywhere (the seed guard checks it).
    GCLOUD_PROJECT: PROJECT_ID,
    GOOGLE_CLOUD_PROJECT: PROJECT_ID,
    // Emulators on this machine (also read by the seed and the Admin SDK).
    FIRESTORE_EMULATOR_HOST: `127.0.0.1:${ports.firestore}`,
    FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${ports.auth}`,
    FIREBASE_STORAGE_EMULATOR_HOST: `127.0.0.1:${ports.storage}`,
    // No CLI chatter to the network.
    FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true',
    NO_UPDATE_NOTIFIER: '1',
    CI: '1',
  });
  return env;
}

/**
 * The extra variables that make Node's outbound HTTP(S) die on a dead local
 * port (Node 24 `NODE_USE_ENV_PROXY`), localhost exempt. Used for the seed
 * process; see the header for why not for the emulators.
 */
export function deadProxyEnv() {
  const proxy = `http://127.0.0.1:${DEAD_PORT}`;
  return {
    HTTP_PROXY: proxy,
    HTTPS_PROXY: proxy,
    http_proxy: proxy,
    https_proxy: proxy,
    NO_PROXY: LOCAL_HOSTS.join(','),
    no_proxy: LOCAL_HOSTS.join(','),
    NODE_USE_ENV_PROXY: '1',
  };
}
