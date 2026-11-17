/*
 * scripts/e2e/lib/sim.mjs — the e2e runner's OWN iOS simulator (japa#361).
 *
 * The runner creates one simulator named "Seli E2E <id>", installs the dev
 * client in it, boots it headless (simctl only; no Simulator.app window) and
 * deletes it at the end. It never boots, shuts down or writes to any other
 * device. Another device is only ever READ, as the source of the dev client:
 *   1. `--app <Seli.app>`: installed as given;
 *   2. else a SHUT-DOWN device that has the dev client is cloned (fast);
 *   3. else the dev client's .app is copied (read-only) out of any device's
 *      data folder into the run's temp folder and installed from there.
 *
 * SAFETY: every mutating call goes through ownedDevice(), which needs the
 * "Seli E2E " name AND an ownership marker this module writes (one file per
 * UDID under ~/Library/Caches/seli-e2e/sims/, holding the runner's PID). A
 * device someone named "Seli E2E ..." by hand has no marker and is refused.
 * Markers whose runner PID is gone (a killed run) let the next run delete
 * that leftover device.
 *
 * Ideas from scripts/qa/sim.mjs (japa#342, unmerged); no dependency on it.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const E2E_PREFIX = 'Seli E2E ';
const MARKER_DIR = path.join(
  os.homedir(),
  'Library',
  'Caches',
  'seli-e2e',
  'sims',
);

/** `xcrun simctl ...args` → trimmed stdout. Throws (or null when quiet). */
export function simctl(args, { quiet = false, timeout = 180_000 } = {}) {
  try {
    return execFileSync('xcrun', ['simctl', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    }).trim();
  } catch (e) {
    if (quiet) return null;
    const msg = String(e.stderr || e.message).trim();
    throw new Error(`xcrun simctl ${args.join(' ')} failed: ${msg}`);
  }
}

/** Every simulator device, flattened. */
export function listDevices() {
  const json = JSON.parse(simctl(['list', 'devices', '-j']));
  const out = [];
  for (const [runtime, devices] of Object.entries(json.devices)) {
    for (const d of devices) out.push({ ...d, runtime });
  }
  return out;
}

function deviceByUdid(udid) {
  return listDevices().find((d) => d.udid === udid);
}

// ── Ownership markers ─────────────────────────────────────────────────────────
const markerPath = (udid) => path.join(MARKER_DIR, `${udid}.json`);

function writeMarker(udid, name) {
  fs.mkdirSync(MARKER_DIR, { recursive: true });
  fs.writeFileSync(
    markerPath(udid),
    JSON.stringify(
      { udid, name, pid: process.pid, createdAt: new Date().toISOString() },
      null,
      2,
    ),
  );
}

function readMarker(udid) {
  try {
    return JSON.parse(fs.readFileSync(markerPath(udid), 'utf8'));
  } catch {
    return null;
  }
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

/** The device, if this runner made it (prefix + marker); throws otherwise. */
export function ownedDevice(udid) {
  const d = deviceByUdid(udid);
  if (!d) throw new Error(`no simulator ${udid}`);
  if (!d.name.startsWith(E2E_PREFIX) || !readMarker(udid)) {
    throw new Error(
      `refusing to touch "${d.name}" (${udid}): not made by the e2e runner`,
    );
  }
  return d;
}

// ── Reading an installed app (read-only, works on any device) ─────────────────
function plistValue(plist, key, format) {
  try {
    return execFileSync('plutil', ['-extract', key, format, '-o', '-', plist], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/** { appPath, bundleId, schemes } for an .app folder. */
export function appInfo(appPath) {
  const plist = path.join(appPath, 'Info.plist');
  if (!fs.existsSync(plist))
    throw new Error(`${appPath} is not an .app bundle (no Info.plist)`);
  const types = plistValue(plist, 'CFBundleURLTypes', 'json');
  return {
    appPath,
    bundleId: plistValue(plist, 'CFBundleIdentifier', 'raw'),
    schemes: types
      ? JSON.parse(types).flatMap((t) => t.CFBundleURLSchemes || [])
      : [],
  };
}

/** The dev client (bundle id match + an exp+ scheme) installed on a device. */
export function findDevClient(device, bundleId) {
  const root = path.join(
    device.dataPath,
    'Containers',
    'Bundle',
    'Application',
  );
  if (!fs.existsSync(root)) return null;
  for (const container of fs.readdirSync(root)) {
    let entries = [];
    try {
      entries = fs.readdirSync(path.join(root, container));
    } catch {
      continue;
    }
    for (const e of entries.filter((x) => x.endsWith('.app'))) {
      try {
        const info = appInfo(path.join(root, container, e));
        if (
          info.bundleId === bundleId &&
          info.schemes.some((s) => s.startsWith('exp+'))
        ) {
          return info;
        }
      } catch {
        // not an app bundle we can read
      }
    }
  }
  return null;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

/**
 * Deletes leftover "Seli E2E" devices from earlier runs that were killed
 * before their teardown (marker present, its runner PID gone). Returns the
 * names removed. A device of a run still going is left alone.
 */
export function removeStaleDevices(log = () => {}) {
  const removed = [];
  for (const d of listDevices()) {
    if (!d.name.startsWith(E2E_PREFIX)) continue;
    const m = readMarker(d.udid);
    if (!m || pidAlive(m.pid)) continue;
    log(
      `removing leftover simulator ${d.name} (${d.udid}) from a run that did not finish`,
    );
    simctl(['shutdown', d.udid], { quiet: true });
    simctl(['delete', d.udid], { quiet: true });
    fs.rmSync(markerPath(d.udid), { force: true });
    removed.push(d.name);
  }
  return removed;
}

/**
 * Creates and boots the run's simulator with the dev client installed.
 *   name:       "Seli E2E <id>"
 *   bundleId:   the dev client's bundle id (app.json)
 *   app:        optional path to a Seli.app (--app)
 *   deviceType: simctl device type for a fresh device (default iPhone 17)
 *   tmpDir:     the run's temp folder (a copied .app goes there)
 * Returns { udid, name, app } where app = appInfo of the installed client.
 */
export function createE2eDevice({
  name,
  bundleId,
  app,
  deviceType = 'iPhone 17',
  tmpDir,
  log = () => {},
}) {
  if (!name.startsWith(E2E_PREFIX))
    throw new Error(`device name must start with "${E2E_PREFIX}"`);
  if (listDevices().some((d) => d.name === name))
    throw new Error(`"${name}" already exists`);

  let source = null; // { kind: 'app', info } | { kind: 'clone', device, info }
  if (app) {
    source = { kind: 'app', info: appInfo(path.resolve(app)) };
    if (source.info.bundleId !== bundleId) {
      throw new Error(
        `${app} is ${source.info.bundleId}, expected the dev client ${bundleId}`,
      );
    }
  } else {
    const all = listDevices().filter(
      (d) => d.isAvailable !== false && !d.name.startsWith(E2E_PREFIX),
    );
    const shut = all.find(
      (d) => d.state === 'Shutdown' && findDevClient(d, bundleId),
    );
    if (shut) {
      source = {
        kind: 'clone',
        device: shut,
        info: findDevClient(shut, bundleId),
      };
    } else {
      // Read-only copy of the .app out of any device (booted ones included).
      const holder = all.find((d) => findDevClient(d, bundleId));
      if (!holder) {
        throw new Error(
          `no simulator has the dev client ${bundleId}; pass --app <path/to/Seli.app> ` +
            '(an ios-simulator development build, see .maestro/README.md)',
        );
      }
      const found = findDevClient(holder, bundleId);
      const copy = path.join(tmpDir, path.basename(found.appPath));
      log(
        `copying the dev client from "${holder.name}" (read-only) to ${copy}`,
      );
      execFileSync('cp', ['-R', found.appPath, copy]);
      source = { kind: 'app', info: appInfo(copy) };
    }
  }

  let udid;
  if (source.kind === 'clone') {
    log(
      `cloning shut-down "${source.device.name}" (${source.device.udid}) as "${name}"`,
    );
    udid = simctl(['clone', source.device.udid, name], { timeout: 600_000 });
    writeMarker(udid, name);
    simctl(['boot', udid]);
  } else {
    udid = simctl(['create', name, deviceType]);
    writeMarker(udid, name);
    simctl(['boot', udid]);
  }
  // Blocks until the device has finished booting (headless: no window).
  simctl(['bootstatus', udid, '-b'], { timeout: 600_000 });
  if (source.kind === 'app') {
    log(`installing ${source.info.appPath}`);
    simctl(['install', udid, source.info.appPath], { timeout: 600_000 });
  }
  return { udid, name, app: source.info };
}

/**
 * Pre-approves every URL scheme of the dev client, so `simctl openurl` and
 * Maestro's openLink open the app straight away instead of stopping at an
 * "Open in Seli?" alert, turns off the Expo dev menu's first-run sheet and
 * its show-at-launch, and pre-grants notifications when simctl can.
 */
export function prepareDevice(udid, app) {
  ownedDevice(udid);
  for (const scheme of app.schemes) {
    simctl([
      'spawn',
      udid,
      'defaults',
      'write',
      'com.apple.launchservices.schemeapproval',
      `com.apple.CoreSimulator.CoreSimulatorBridge-->${scheme}`,
      '-string',
      app.bundleId,
    ]);
  }
  simctl([
    'spawn',
    udid,
    'defaults',
    'write',
    app.bundleId,
    'EXDevMenuIsOnboardingFinished',
    '-bool',
    'YES',
  ]);
  // QA of japa#375: on a fresh device the dev menu also opens by itself on
  // launch and covers the screen.
  simctl([
    'spawn',
    udid,
    'defaults',
    'write',
    app.bundleId,
    'EXDevMenuShowsAtLaunch',
    '-bool',
    'NO',
  ]);
  // Pre-grant notifications where this Xcode's simctl supports it (older
  // ones do not list the service; the flows answer the alert then).
  simctl(['privacy', udid, 'grant', 'notifications', app.bundleId], {
    quiet: true,
  });
}

/** Opens a URL on OUR device (e.g. the dev-client link to our Metro). */
export function openUrl(udid, url) {
  ownedDevice(udid);
  simctl(['openurl', udid, url]);
}

/** Shuts down and deletes OUR device; quiet, so it is safe in cleanup. */
export function deleteE2eDevice(udid) {
  try {
    ownedDevice(udid);
  } catch {
    return false;
  }
  simctl(['shutdown', udid], { quiet: true, timeout: 120_000 });
  simctl(['delete', udid], { quiet: true, timeout: 120_000 });
  fs.rmSync(markerPath(udid), { force: true });
  return !deviceByUdid(udid);
}
