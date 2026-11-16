#!/usr/bin/env node
/*
 * scripts/e2e/run.mjs — the Maestro end-to-end runner (japa#361).
 *
 *   npm run e2e                               # the whole suite
 *   npm run e2e -- --tags auth,flag           # flows with ANY of these tags
 *   npm run e2e -- --flow .maestro/flows/auth/sign-in.yaml   # one file (repeatable)
 *   npm run e2e -- --list                     # list flows and tags, run nothing
 *
 * Options (each also as an environment variable):
 *   --backend <dir>   seli-backend checkout     SELI_E2E_BACKEND (default: ../seli-backend)
 *   --app <Seli.app>  dev client to install     SELI_E2E_APP     (default: copied/cloned, see lib/sim.mjs)
 *   --port <n>        Metro port                SELI_E2E_METRO_PORT (default: first free from 8090)
 *   --out <dir>       logs, report, failures    SELI_E2E_OUT     (default: <os tmp>/seli-e2e/<run id>)
 *   --device-type <t> simulator model           SELI_E2E_DEVICE_TYPE (default: iPhone 17)
 *
 * What one run does, in order (everything it starts, it stops; see cleanup):
 *   1. checks Maestro, Java, the Firebase CLI and Xcode are installed
 *   2. reads and checks the flows' tags, selects the flows to run
 *   3. checks every e2e emulator port (seli-backend/firebase.e2e.json) and the
 *      Metro port are free; never uses 8081-8083
 *   4. cuts off real access (lib/safety.mjs), builds the functions, starts the
 *      emulators under `durin-seli-dev` and seeds them (full seed + fixture)
 *   5. creates its own simulator "Seli E2E <id>" with the dev client
 *   6. starts Metro with the emulator settings, checks the manifest it serves
 *      points at the local emulators, opens the dev client on it and waits
 *      for the "iOS Bundled" line in ITS OWN Metro log
 *   7. preflight flow: signs in and reads the in-app App configuration screen
 *      (the running bundle's API server must be the local Functions emulator)
 *   8. runs the selected flows with Maestro on that simulator, BY UDID
 *   9. restores the self-service-only flag to the build's value, prints the
 *      per-flow summary and the output folder
 *  10. tears down Metro, the emulators, the simulator and the temp files, also
 *      on failure and on Ctrl-C, and checks the ports are free again
 * Exit code: 0 when every selected flow passed, 1 otherwise, 2 for set-up
 * problems found before anything started, 130 on Ctrl-C.
 *
 * Node built-ins only. See .maestro/README.md.
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { discoverFlows, selectFlows, orderFlows } from './lib/flows.mjs';
import {
  checkMetroPort,
  emulatorPorts,
  isPortFree,
  listeners,
  pickMetroPort,
  QA_WALK_PORTS,
} from './lib/ports.mjs';
import {
  DUMMY_SECRET,
  PROJECT_ID,
  assertEmulatorHosts,
  cutOffEnv,
  deadProxyEnv,
  emailSwitchProblems,
  fakeServiceAccount,
  planSecretFile,
  secretFileContent,
} from './lib/safety.mjs';
import {
  readLog,
  sleepSync,
  startLogged,
  stopGroup,
  waitForLog,
} from './lib/proc.mjs';
import {
  createE2eDevice,
  deleteE2eDevice,
  openUrl,
  prepareDevice,
  removeStaleDevices,
} from './lib/sim.mjs';
import { formatSummary, parseJunit, summarise } from './lib/report.mjs';

const MOBILE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const MAESTRO_DIR = path.join(MOBILE_ROOT, '.maestro');

/** A set-up problem: printed as one message, exit 2, nothing left running. */
class SetupError extends Error {}

const log = (msg) => console.log(`[e2e] ${msg}`);

// ── Cleanup stack ─────────────────────────────────────────────────────────────
// Every resource registers how to undo itself the moment it exists. The stack
// runs LIFO exactly once: at the end, on an error, or on Ctrl-C / SIGTERM.
// Steps are synchronous so they also run from a signal handler.
const cleanups = [];
let cleanedUp = false;
/** The Maestro child in flight ({ name, pid }), stopped first on cleanup. */
let maestroProc = null;
/** Set when main() fails, so cleanup can keep a failure screenshot. */
let runFailed = false;
/** How often the dev-client load step was retried (reported in the summary). */
let loadRetries = 0;
/** Ports this run binds (emulators + Metro), checked free after teardown. */
const runPorts = [];
function onCleanup(what, fn) {
  cleanups.push({ what, fn });
}
function runCleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  // A Maestro run in flight stops first: it drives the simulator.
  if (maestroProc) stopGroup(maestroProc, { graceMs: 5_000 });
  while (cleanups.length) {
    const { what, fn } = cleanups.pop();
    try {
      fn();
    } catch (e) {
      console.error(`[e2e] cleanup "${what}" failed: ${e.message}`);
    }
  }
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    console.error(`\n[e2e] ${sig}: stopping everything this run started...`);
    runCleanup();
    process.exit(130);
  });
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function which(bin) {
  try {
    return execFileSync('/usr/bin/which', [bin], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/** Runs a command to completion with output to a log file; throws on failure. */
function runLogged(name, cmd, args, { cwd, env, logFile, timeout = 900_000 }) {
  const fd = fs.openSync(logFile, 'a');
  try {
    execFileSync(cmd, args, { cwd, env, stdio: ['ignore', fd, fd], timeout });
  } catch (e) {
    const tail = fs
      .readFileSync(logFile, 'utf8')
      .split('\n')
      .slice(-30)
      .join('\n');
    throw new Error(
      `${name} failed (${e.status ?? e.signal ?? e.message}):\n${tail}`,
    );
  } finally {
    fs.closeSync(fd);
  }
}

/** Is `child` inside `parent` (or the same folder)? */
const isInside = (child, parent) => {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

// ── 1. Prerequisites ──────────────────────────────────────────────────────────
function checkPrerequisites() {
  const missing = [];
  if (!which('maestro')) {
    missing.push(
      'Maestro CLI. Install it with its official method (see .maestro/README.md, "Prerequisites"):\n' +
        '    brew tap mobile-dev-inc/tap && brew install mobile-dev-inc/tap/maestro\n' +
        '  or\n' +
        '    curl -fsSL "https://get.maestro.mobile.dev" | bash',
    );
  }
  let javaOk = false;
  if (which('java')) {
    try {
      // `java -version` prints to stderr; any successful run counts.
      execFileSync('java', ['-version'], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      javaOk = true;
    } catch {
      javaOk = false;
    }
  }
  if (!javaOk) {
    missing.push(
      'A Java runtime (17 or newer), from an official distribution:\n' +
        "    brew install openjdk@21    (then follow brew's note to put it on PATH)\n" +
        '  or Eclipse Temurin from https://adoptium.net',
    );
  }
  if (!which('firebase')) {
    missing.push(
      'The Firebase CLI (firebase-tools):\n    npm install -g firebase-tools',
    );
  }
  if (!which('xcrun')) missing.push('Xcode command line tools (xcrun simctl).');
  if (missing.length) {
    throw new SetupError(
      `missing prerequisites:\n\n- ${missing.join('\n\n- ')}\n`,
    );
  }
}

// ── Options ───────────────────────────────────────────────────────────────────
function readOptions() {
  const { values } = parseArgs({
    options: {
      tags: { type: 'string', multiple: true },
      flow: { type: 'string', multiple: true },
      backend: { type: 'string' },
      app: { type: 'string' },
      port: { type: 'string' },
      out: { type: 'string' },
      'device-type': { type: 'string' },
      list: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
    console.log(
      src
        .split('\n')
        .slice(2, 17)
        .map((l) => l.replace(/^ \* ?/, ''))
        .join('\n'),
    );
    process.exit(0);
  }
  const env = process.env;
  return {
    tags: (values.tags ?? [])
      .flatMap((t) => t.split(','))
      .map((t) => t.trim())
      .filter(Boolean),
    files: values.flow ?? [],
    backend: path.resolve(
      values.backend ??
        env.SELI_E2E_BACKEND ??
        path.join(MOBILE_ROOT, '..', 'seli-backend'),
    ),
    app: values.app ?? env.SELI_E2E_APP,
    port: values.port ?? env.SELI_E2E_METRO_PORT,
    out: values.out ?? env.SELI_E2E_OUT,
    deviceType:
      values['device-type'] ?? env.SELI_E2E_DEVICE_TYPE ?? 'iPhone 17',
    list: !!values.list,
  };
}

// ── The backend checkout and the fixture's accounts ───────────────────────────
function readBackend(dir) {
  const cfgPath = path.join(dir, 'firebase.e2e.json');
  const fnPkg = path.join(dir, 'functions', 'package.json');
  if (!fs.existsSync(cfgPath) || !fs.existsSync(fnPkg)) {
    throw new SetupError(
      `${dir} is not a seli-backend checkout with the e2e set-up (no firebase.e2e.json or functions/). ` +
        'Pass --backend <path> or set SELI_E2E_BACKEND.',
    );
  }
  if (!JSON.parse(fs.readFileSync(fnPkg, 'utf8')).scripts?.['seed:e2e']) {
    throw new SetupError(
      `${dir}/functions has no "seed:e2e" script; it needs japa#361's backend part.`,
    );
  }
  const config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const em = config.emulators ?? {};
  if (em.ui?.enabled !== false)
    throw new SetupError('firebase.e2e.json must turn the emulator UI off');

  // Accounts come from the backend's own sources, so they cannot drift.
  const src = (rel) =>
    fs.readFileSync(path.join(dir, 'functions', 'src', rel), 'utf8');
  const seed = src('data/seed-portal-data.ts');
  const fixture = src('scripts/e2e/e2e-fixture-data.ts');
  const password = /export const SEED_PASSWORD = "([^"]+)"/.exec(seed)?.[1];
  const label = /clientEmailLabel: "([^"]+)"/.exec(fixture)?.[1];
  if (!password || !label || !seed.includes('resendTestEmail("john.doe")')) {
    throw new SetupError(
      'could not read the seed password / fixture accounts from seli-backend sources',
    );
  }
  return {
    dir,
    config,
    ports: {
      functions: em.functions?.port,
      firestore: em.firestore?.port,
      auth: em.auth?.port,
      storage: em.storage?.port,
    },
    accounts: {
      // The emulator-only fixture client (free plan, no applications).
      e2eEmail: `delivered+${label}@resend.dev`,
      // The seeded client with the agent-managed seed-app-001 (flag flows).
      flagEmail: 'delivered+john.doe@resend.dev',
      password,
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const opts = readOptions();
  const started = Date.now();

  // 2. Flows first: a mis-tagged flow or a bad selection stops before
  //    anything boots.
  const allFlows = discoverFlows(MAESTRO_DIR);
  if (opts.list) {
    for (const f of orderFlows(allFlows))
      console.log(`${f.rel}  [${f.tags.join(', ')}]`);
    return 0;
  }
  const flows = selectFlows(allFlows, { tags: opts.tags, files: opts.files });
  log(`flows: ${flows.map((f) => f.rel).join(', ')}`);

  // 1. Tools.
  checkPrerequisites();

  const backend = readBackend(opts.backend);
  const runId = `${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}-${process.pid}`;
  const outDir = path.resolve(
    opts.out ?? path.join(os.tmpdir(), 'seli-e2e', runId),
  );
  if (isInside(outDir, MOBILE_ROOT) || isInside(outDir, backend.dir)) {
    throw new SetupError(`--out must be outside the repos (got ${outDir})`);
  }
  fs.mkdirSync(outDir, { recursive: true });
  log(`output folder: ${outDir}`);

  // 3. Ports. Emulators: every one free, or stop naming it.
  const emPorts = emulatorPorts(backend.config);
  for (const { name, port } of emPorts) {
    if (!(await isPortFree(port))) {
      const pids = listeners(port);
      throw new SetupError(
        `emulator port ${port} (${name}, firebase.e2e.json) is taken${pids.length ? ` by PID ${pids.join(', ')}` : ''}. ` +
          'Another e2e run may be going; the runner never reuses a process it did not start.',
      );
    }
  }
  let metroPort;
  if (opts.port) {
    metroPort = checkMetroPort(opts.port);
    if (!(await isPortFree(metroPort)))
      throw new SetupError(`Metro port ${metroPort} is in use`);
    if (QA_WALK_PORTS.includes(metroPort))
      log(`warning: ${metroPort} is in the QA-walk range 8084-8089`);
  } else {
    metroPort = await pickMetroPort();
  }
  runPorts.push(...emPorts.map((p) => p.port), metroPort);
  log(
    `Metro port ${metroPort}; emulator ports ${emPorts.map((p) => p.port).join(', ')}`,
  );

  // 4. Cut off real access (lib/safety.mjs) and start the emulators.
  const functionsDir = path.join(backend.dir, 'functions');
  const emailProblems = emailSwitchProblems(functionsDir);
  if (emailProblems.length) {
    throw new SetupError(
      `a functions env file switches local email on (${emailProblems.join('; ')}); ` +
        'the e2e emulators must never send email. Remove the line and run again.',
    );
  }
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `seli-e2e-private-${process.pid}-`),
  );
  onCleanup('remove the temp credentials', () =>
    fs.rmSync(tmpDir, { recursive: true, force: true }),
  );
  const tmp = {
    credentials: path.join(tmpDir, 'fake-service-account.json'),
    cloudsdk: path.join(tmpDir, 'gcloud'),
    xdg: path.join(tmpDir, 'xdg'),
  };
  fs.mkdirSync(tmp.cloudsdk);
  fs.mkdirSync(tmp.xdg);
  fs.writeFileSync(tmp.credentials, JSON.stringify(fakeServiceAccount()), {
    mode: 0o600,
  });
  const emEnv = cutOffEnv(process.env, tmp, backend.ports);

  log('building the functions (npm run build)...');
  runLogged(
    'functions build',
    'npm',
    ['--prefix', functionsDir, 'run', 'build'],
    {
      cwd: backend.dir,
      env: emEnv,
      logFile: path.join(outDir, 'functions-build.log'),
    },
  );

  // Every secret the built functions declare (command from
  // seli-backend/docs/e2e-emulators.md, "Declared secrets").
  const declared = execFileSync(
    'node',
    [
      '-e',
      'const m=require("./lib/index.js"),s=new Set();' +
        'for (const v of Object.values(m)) for (const x of (v&&v.__endpoint&&v.__endpoint.secretEnvironmentVariables)||[]) s.add(x.key);' +
        'console.log([...s].sort().join(" ")); process.exit(0)',
    ],
    {
      cwd: functionsDir,
      env: {
        ...emEnv,
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:1',
        GCLOUD_PROJECT: 'demo-list',
        GOOGLE_CLOUD_PROJECT: 'demo-list',
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
    .trim()
    .split('\n')
    .pop()
    .split(/\s+/)
    .filter(Boolean);
  if (!declared.length)
    throw new SetupError('could not list the secrets the functions declare');
  const secretPath = path.join(functionsDir, '.secret.local');
  const plan = planSecretFile(
    fs.existsSync(secretPath) ? fs.readFileSync(secretPath, 'utf8') : null,
    declared,
  );
  if (plan.action === 'refuse') throw new SetupError(plan.reason);
  if (plan.action === 'write') {
    // 'wx': create only, so a file that appeared meanwhile is never overwritten.
    fs.writeFileSync(secretPath, secretFileContent(declared), {
      flag: 'wx',
      mode: 0o600,
    });
    onCleanup('remove the dummy .secret.local', () => {
      // Only if it still holds exactly what we wrote.
      if (
        fs.existsSync(secretPath) &&
        fs.readFileSync(secretPath, 'utf8') === secretFileContent(declared)
      ) {
        fs.rmSync(secretPath);
      }
    });
  }
  log(
    `dummy values (${DUMMY_SECRET}) for ${declared.length} declared secrets: ${declared.join(', ')}`,
  );

  log(
    'starting the emulators (functions, firestore, auth, storage, pubsub)...',
  );
  const emulators = startLogged(
    'emulators',
    'firebase',
    [
      'emulators:start',
      '--project',
      PROJECT_ID,
      '--config',
      'firebase.e2e.json',
      '--only',
      'functions,firestore,auth,storage,pubsub',
    ],
    {
      cwd: backend.dir,
      env: emEnv,
      logFile: path.join(outDir, 'emulators.log'),
    },
  );
  onCleanup('stop the emulators', () =>
    stopGroup(emulators, { graceMs: 20_000 }),
  );
  await waitForLog(emulators, (t) => /All emulators ready/.test(t), {
    timeoutMs: 240_000,
    what: 'the emulators',
  });
  await waitForLog(
    emulators,
    (t) => /http function initialized.*\/api\b|us-central1-api\b/.test(t),
    {
      timeoutMs: 120_000,
      what: 'the api function to load',
    },
  );
  const apiBase = `http://127.0.0.1:${backend.ports.functions}/${PROJECT_ID}/us-central1/api`;
  log(`emulators ready; API ${apiBase}`);

  // Seed: full seed + fixture. The hosts are checked here and by the script.
  assertEmulatorHosts(emEnv);
  log('seeding (full seed + e2e fixture)...');
  runLogged('seed:e2e', 'node', ['lib/scripts/seed-e2e.js'], {
    cwd: functionsDir,
    env: { ...emEnv, ...deadProxyEnv() },
    logFile: path.join(outDir, 'seed.log'),
  });

  // 5. Our simulator.
  removeStaleDevices(log);
  const bundleId = JSON.parse(
    fs.readFileSync(path.join(MOBILE_ROOT, 'app.json'), 'utf8'),
  ).expo.ios.bundleIdentifier;
  const deviceName = `Seli E2E ${runId}`;
  log(`creating simulator "${deviceName}"...`);
  let device;
  try {
    device = createE2eDevice({
      name: deviceName,
      bundleId,
      app: opts.app,
      deviceType: opts.deviceType,
      tmpDir,
      log,
    });
  } finally {
    // Registered even if creation failed half-way (the marker exists by then).
    onCleanup('delete the simulator', () => {
      const made = JSON.parse(
        execFileSync('xcrun', ['simctl', 'list', 'devices', '-j'], {
          encoding: 'utf8',
        }),
      );
      for (const list of Object.values(made.devices)) {
        for (const d of list)
          if (d.name === deviceName) deleteE2eDevice(d.udid);
      }
    });
  }
  prepareDevice(device.udid, device.app);
  // On any later failure, keep a picture of the simulator screen in the
  // output folder (registered after the delete step, so it runs first).
  onCleanup('screenshot the simulator on failure', () => {
    if (runFailed) {
      execFileSync(
        'xcrun',
        [
          'simctl',
          'io',
          device.udid,
          'screenshot',
          path.join(outDir, 'failure-screen.png'),
        ],
        {
          stdio: 'ignore',
          timeout: 20_000,
        },
      );
    }
  });
  const devScheme = device.app.schemes.find((s) => s.startsWith('exp+'));
  log(
    `simulator ${device.udid} booted (headless), dev client ${device.app.bundleId}`,
  );

  // 6. Metro with the emulator settings (the app reads them via app.config.ts
  //    extra; EXPO_PUBLIC_SELF_SERVICE_ONLY stays off: flows switch the flag
  //    with the development link from japa#375).
  const metroEnv = {
    ...process.env,
    APP_ENV: 'development',
    EXPO_PUBLIC_USE_EMULATOR: 'true',
    EXPO_PUBLIC_EMULATOR_PROJECT_ID: PROJECT_ID,
    EXPO_PUBLIC_EMULATOR_AUTH_PORT: String(backend.ports.auth),
    EXPO_PUBLIC_EMULATOR_FUNCTIONS_PORT: String(backend.ports.functions),
    EXPO_PUBLIC_SELF_SERVICE_ONLY: 'false',
    // No Expo account / update checks / telemetry: Metro serves locally only.
    // `--localhost` binds "localhost", which Node resolves to ::1 first on
    // this machine, while the manifest hands the app a 127.0.0.1 bundle URL
    // (seen on the first runs: "Could not connect to development server").
    // IPv4-first makes Metro listen where the app looks.
    NODE_OPTIONS: [process.env.NODE_OPTIONS, '--dns-result-order=ipv4first']
      .filter(Boolean)
      .join(' '),
    EXPO_OFFLINE: '1',
    EXPO_NO_TELEMETRY: '1',
    CI: '1',
    BROWSER: 'none',
  };
  log(`starting Metro on ${metroPort}...`);
  const metro = startLogged(
    'metro',
    'npx',
    [
      'expo',
      'start',
      '--dev-client',
      '--localhost',
      '--port',
      String(metroPort),
    ],
    {
      cwd: MOBILE_ROOT,
      env: metroEnv,
      logFile: path.join(outDir, 'metro.log'),
    },
  );
  onCleanup('stop Metro', () => stopGroup(metro));
  await waitForLog(metro, (t) => /Waiting on http:\/\/localhost:\d+/.test(t), {
    timeoutMs: 180_000,
    what: 'Metro',
  });
  if (!listeners(metroPort).length)
    throw new Error(`Metro says it is up but nothing listens on ${metroPort}`);
  await checkManifest(metroPort, backend.ports);

  // Load the bundle and confirm it came from OUR Metro.
  const metroUrl = `http://127.0.0.1:${metroPort}`;
  const devClientUrl = `${devScheme}://expo-development-client/?url=${encodeURIComponent(metroUrl)}`;
  log('loading the bundle (the first build can take a few minutes)...');
  loadRetries = await loadBundle(device, metro, devClientUrl);
  log('bundle served by this run\'s Metro ("iOS Bundled" seen)');

  // 7-8. Maestro.
  const maestroEnv = {
    APP_ID: bundleId,
    DEV_CLIENT_URL: devClientUrl,
    METRO_PORT: String(metroPort),
    API_URL: `http://localhost:${backend.ports.functions}/${PROJECT_ID}/us-central1/api`,
    // Auth emulator, for runScript helpers that read ids (localhost only).
    AUTH_URL: `http://localhost:${backend.ports.auth}`,
    E2E_EMAIL: backend.accounts.e2eEmail,
    FLAG_EMAIL: backend.accounts.flagEmail,
    PASSWORD: backend.accounts.password,
    FLAG_APP_ID: 'seed-app-001',
  };
  const maestro = (label, files) =>
    runMaestro(label, files, { udid: device.udid, outDir, env: maestroEnv });

  log("preflight: sign in and check the running app's API server...");
  const pre = await maestro('preflight', [
    path.join(MAESTRO_DIR, 'support', 'preflight.yaml'),
  ]);
  if (!pre.ok) {
    throw new Error(
      'preflight failed: the app did not sign in against the local emulators, or its API server is not ' +
        `${maestroEnv.API_URL}. Nothing else ran. See ${pre.dir}`,
    );
  }

  log(`running ${flows.length} flow(s)...`);
  const suiteStart = Date.now();
  const suite = await maestro(
    'suite',
    flows.map((f) => f.file),
  );
  const suiteSeconds = (Date.now() - suiteStart) / 1000;

  // 9. Leave the flag at the build's value (flows set what they need).
  const restore = await maestro('restore-flag', [
    path.join(MAESTRO_DIR, 'support', 'restore-flag.yaml'),
  ]);
  if (!restore.ok)
    log(
      'warning: could not restore the self-service-only flag (the simulator is deleted anyway)',
    );

  const cases = fs.existsSync(suite.report)
    ? parseJunit(fs.readFileSync(suite.report, 'utf8'))
    : [];
  const rows = summarise(flows, cases);
  const allPassed = rows.every((r) => r.passed) && suite.ok;
  console.log(`\n${formatSummary(rows, suiteSeconds)}`);
  // Dev-client "Failed to load app" retries (subflows/launch.yaml retries the
  // LOAD step once and leaves a `load-retry` screenshot). Said, not hidden.
  const retries =
    countFiles(path.join(suite.dir, 'artifacts'), /load-retry/) +
    countFiles(path.join(suite.dir, 'debug'), /load-retry/) +
    loadRetries;
  console.log(
    retries
      ? `note: the dev client failed to load ${retries} time(s) and the load step was retried once each time`
      : 'dev-client load retries: none',
  );
  console.log(`\nwall clock ${((Date.now() - started) / 1000).toFixed(0)}s`);
  console.log(
    `logs, report${allPassed ? '' : ', failure screenshots'}: ${outDir}`,
  );
  return allPassed ? 0 : 1;
}

/**
 * Opens the dev client on our Metro and waits for "iOS Bundled" in OUR Metro
 * log. Returns how many times the load step had to be retried.
 *
 * The dev client ignores a link that cold-starts it (it opens its launcher,
 * "No development servers found"; also QA of japa#375), so the app is
 * launched first and the link sent once it runs. The link is resent once if
 * Metro saw no bundle request within LOAD_RETRY_MS: the known ~1-in-8
 * "Failed to load app" of the dev client. A retry is reported, never hidden.
 */
const LOAD_RETRY_MS = 90_000;
async function loadBundle(device, metro, devClientUrl) {
  const bundled = () => (readLog(metro).match(/iOS Bundled/g) ?? []).length;
  // The app has asked for the bundle once it holds a connection to Metro
  // (Metro logs nothing until the build is done, which can take minutes).
  const port = Number(
    new URL(decodeURIComponent(devClientUrl.split('url=')[1])).port,
  );
  const requested = () =>
    /iOS (Bundling|Bundled)/.test(readLog(metro)) || connectedTo(port);
  const before = bundled();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      execFileSync(
        'xcrun',
        ['simctl', 'terminate', device.udid, device.app.bundleId],
        { stdio: 'ignore' },
      );
    } catch {
      // not running yet
    }
    execFileSync(
      'xcrun',
      ['simctl', 'launch', device.udid, device.app.bundleId],
      { stdio: 'ignore' },
    );
    // Wait for the app process to be up (a real condition), then a short
    // settle so its link handler is registered before the link arrives.
    await waitFor(() => appRunning(device), 30_000, 'the dev client to start');
    await new Promise((r) => setTimeout(r, 2_000));
    openUrl(device.udid, devClientUrl);
    try {
      // First the request (fast), then the finished bundle (slow build).
      await waitForLog(metro, () => requested(), {
        timeoutMs: LOAD_RETRY_MS,
        what: 'a bundle request',
      });
      await waitForLog(metro, () => bundled() > before, {
        timeoutMs: 600_000,
        what: 'the "iOS Bundled" line in this run\'s Metro log',
      });
      return attempt;
    } catch (e) {
      if (attempt === 1 || requested()) throw e;
      log(
        'the dev client did not request the bundle; retrying the load step once',
      );
    }
  }
  return 1;
}

/** Whether any client holds an ESTABLISHED connection to a local port. */
function connectedTo(port) {
  try {
    const out = execFileSync(
      'lsof',
      ['-nP', `-iTCP:${port}`, '-sTCP:ESTABLISHED', '-t'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

function appRunning(device) {
  try {
    const out = execFileSync(
      'xcrun',
      ['simctl', 'spawn', device.udid, 'launchctl', 'list'],
      { encoding: 'utf8' },
    );
    return out.includes(`UIKitApplication:${device.app.bundleId}[`);
  } catch {
    return false;
  }
}

async function waitFor(check, timeoutMs, what) {
  const until = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

/**
 * Checks the manifest Metro serves to iOS: the extra the app will read must
 * point at THIS run's emulators. A wrong env here would send the app to the
 * deployed dev backend, so the run stops.
 */
async function checkManifest(port, ports) {
  const res = await fetch(`http://127.0.0.1:${port}/`, {
    headers: {
      'expo-platform': 'ios',
      accept: 'application/expo+json,application/json',
    },
  });
  const text = await res.text();
  const start = text.indexOf('{');
  const json =
    start >= 0
      ? JSON.parse(text.slice(start, text.lastIndexOf('}') + 1))
      : null;
  const extra = json?.extra?.expoClient?.extra ?? json?.extra ?? {};
  const want = {
    useEmulator: true,
    emulatorProjectId: PROJECT_ID,
    emulatorAuthPort: String(ports.auth),
    emulatorFunctionsPort: String(ports.functions),
    selfServiceOnly: false,
  };
  const wrong = Object.entries(want).filter(([k, v]) => extra[k] !== v);
  if (wrong.length) {
    throw new Error(
      `Metro's manifest does not point at the local emulators: ${wrong
        .map(
          ([k, v]) =>
            `${k}=${JSON.stringify(extra[k])} (want ${JSON.stringify(v)})`,
        )
        .join(', ')}`,
    );
  }
}

/**
 * One Maestro invocation on OUR simulator (by UDID). Output streams to the
 * console and to <out>/<label>/maestro.log; the JUnit report, screenshots
 * and debug logs go to <out>/<label>/. Resolves { ok, report, dir }.
 */
function runMaestro(label, files, { udid, outDir, env }) {
  const dir = path.join(outDir, label);
  fs.mkdirSync(dir, { recursive: true });
  const report = path.join(dir, 'report.xml');
  const args = [
    '--udid',
    udid,
    'test',
    '--no-ansi',
    '--format',
    'JUNIT',
    '--output',
    report,
    '--test-output-dir',
    path.join(dir, 'artifacts'),
    '--debug-output',
    path.join(dir, 'debug'),
    ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
    ...files,
  ];
  const logStream = fs.createWriteStream(path.join(dir, 'maestro.log'));
  return new Promise((resolve) => {
    const child = spawn('maestro', args, {
      cwd: MOBILE_ROOT,
      detached: true, // own group, so cleanup can stop it and its driver
      env: {
        ...process.env,
        // No analytics or AI-analysis prompts from the Maestro CLI.
        MAESTRO_CLI_NO_ANALYTICS: '1',
        MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    maestroProc = { name: `maestro ${label}`, pid: child.pid };
    const tee = (chunk) => {
      process.stdout.write(chunk);
      logStream.write(chunk);
    };
    child.stdout.on('data', tee);
    child.stderr.on('data', tee);
    child.on('exit', (code) => {
      maestroProc = null;
      logStream.end();
      resolve({ ok: code === 0, report, dir });
    });
  });
}

/** Number of files under dir (recursive) whose name matches re. */
function countFiles(dir, re) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) n += countFiles(p, re);
    else if (re.test(e.name)) n += 1;
  }
  return n;
}

/** After teardown: nothing of ours may still listen. */
function verifyPortsFree(ports) {
  const busy = ports.filter((p) => listeners(p).length);
  if (busy.length)
    console.error(
      `[e2e] warning: still listening after teardown: ${busy.join(', ')}`,
    );
  return busy.length === 0;
}

// ── Entry ─────────────────────────────────────────────────────────────────────
let exitCode = 1;
try {
  exitCode = await main();
  runFailed = exitCode !== 0;
} catch (e) {
  runFailed = true;
  if (e instanceof SetupError) {
    console.error(`[e2e] ${e.message}`);
    exitCode = 2;
  } else {
    console.error(`[e2e] error: ${e.message}`);
    exitCode = 1;
  }
} finally {
  log('tearing down (Metro, emulators, simulator, temp files)...');
  runCleanup();
  sleepSync(500);
  if (runPorts.length && verifyPortsFree(runPorts))
    log("all of this run's ports are free again");
  log(`done (exit ${exitCode})`);
}
process.exit(exitCode);
