#!/usr/bin/env node
/*
 * scripts/qa/sim.mjs — simulator helpers for the headless QA walk.
 *
 * Creates, boots, drives and tears down QA's OWN iOS simulator, with no
 * Simulator window. See scripts/qa/README.md for the whole recipe.
 *
 *   node scripts/qa/sim.mjs list
 *   node scripts/qa/sim.mjs create <suffix> [--from <udid|name>] [--bundle-id <id>]
 *   node scripts/qa/sim.mjs create <suffix> --app <path/to/App.app> [--device-type "iPhone 17"]
 *   node scripts/qa/sim.mjs boot <device>
 *   node scripts/qa/sim.mjs info <device>
 *   node scripts/qa/sim.mjs approve-schemes <device>
 *   node scripts/qa/sim.mjs open-dev-client <device> --port <metro-port>
 *   node scripts/qa/sim.mjs open <device> <url>
 *   node scripts/qa/sim.mjs screenshot <device> <path.png>
 *   node scripts/qa/sim.mjs terminate <device>
 *   node scripts/qa/sim.mjs teardown <device>
 *
 * <device> is a UDID or the full device name; QA_UDID in the environment
 * is used when it is left out.
 *
 * SAFETY: every command that changes a device refuses any device whose name
 * does not start with "Seli QA " (the prefix `create` gives). Other sessions
 * run their own simulators on this machine; this script can never boot,
 * shut down or delete one of them. Cloning only READS the source device.
 *
 * Node built-ins only (no npm install needed). Every external command goes
 * through execFileSync with an argument array: no shell, no quoting issues.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

// -----------------------------------------------------------------------------
// Shared constants and guards (walk.mjs imports these too)
// -----------------------------------------------------------------------------

/** Name prefix of every simulator this tool creates — and the only ones it touches. */
export const QA_PREFIX = 'Seli QA ';

/** Ports other sessions' Metro servers use. QA never drives an app on these. */
export const RESERVED_PORTS = [8081, 8082, 8083];

/** A user-facing failure: printed as one line, no stack trace. */
export class QaError extends Error {}

/** Parse and check a Metro port: a number, and not one of the shared ones. */
export function checkPort(raw) {
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new QaError(`invalid Metro port: ${raw}`);
  }
  if (RESERVED_PORTS.includes(port)) {
    throw new QaError(
      `port ${port} belongs to another session's Metro (8081-8083 are off limits). ` +
        'Run your own Metro on a free port >= 8084.',
    );
  }
  return port;
}

// -----------------------------------------------------------------------------
// simctl plumbing
// -----------------------------------------------------------------------------

/** Run `xcrun simctl ...args`, return trimmed stdout; QaError on failure. */
function simctl(args, { quiet = false } = {}) {
  try {
    return execFileSync('xcrun', ['simctl', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (e) {
    if (quiet) return null;
    const msg = String(e.stderr || e.message).trim();
    throw new QaError(`xcrun simctl ${args.join(' ')} failed: ${msg}`);
  }
}

/** Every simulator device, flattened, each with its runtime id. */
function listDevices() {
  const json = JSON.parse(simctl(['list', 'devices', '-j']));
  const out = [];
  for (const [runtime, devices] of Object.entries(json.devices)) {
    for (const d of devices) out.push({ ...d, runtime });
  }
  return out;
}

/** Find a device by UDID or exact name. */
function resolveDevice(ref) {
  if (!ref) {
    throw new QaError('no device given (pass a UDID or name, or set QA_UDID)');
  }
  const all = listDevices();
  const byUdid = all.find((d) => d.udid === ref);
  if (byUdid) return byUdid;
  const byName = all.filter((d) => d.name === ref);
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) {
    throw new QaError(
      `several devices are named "${ref}"; pass a UDID: ` +
        byName.map((d) => d.udid).join(', '),
    );
  }
  throw new QaError(`no simulator matches "${ref}"`);
}

/**
 * Resolve a device AND check this tool created it. Every mutating command
 * goes through here, so a typo'd UDID can never hit someone else's device.
 */
export function ownedDevice(ref) {
  const d = resolveDevice(ref);
  if (!d.name.startsWith(QA_PREFIX)) {
    throw new QaError(
      `refusing to touch "${d.name}" (${d.udid}): only devices named ` +
        `"${QA_PREFIX}..." (made by \`sim.mjs create\`) are handled by this tool`,
    );
  }
  return d;
}

function requireBooted(d) {
  if (d.state !== 'Booted') {
    throw new QaError(`"${d.name}" is ${d.state}; run \`sim.mjs boot\` first`);
  }
}

// -----------------------------------------------------------------------------
// Reading the installed app (bundle id and URL schemes come from Info.plist,
// never hard-coded, so the tool follows the app if they change)
// -----------------------------------------------------------------------------

/** One key of a plist as JSON (or raw string), via macOS's plutil. */
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

/** Every .app installed on a device (works while it is shut down too). */
function installedApps(d) {
  const root = path.join(d.dataPath, 'Containers', 'Bundle', 'Application');
  if (!fs.existsSync(root)) return [];
  const apps = [];
  for (const container of fs.readdirSync(root)) {
    const dir = path.join(root, container);
    let entries = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries.filter((e) => e.endsWith('.app'))) {
      const plist = path.join(dir, entry, 'Info.plist');
      if (!fs.existsSync(plist)) continue;
      const bundleId = plistValue(plist, 'CFBundleIdentifier', 'raw');
      const types = plistValue(plist, 'CFBundleURLTypes', 'json');
      const schemes = types
        ? JSON.parse(types).flatMap((t) => t.CFBundleURLSchemes || [])
        : [];
      apps.push({ appPath: path.join(dir, entry), bundleId, schemes });
    }
  }
  return apps;
}

/**
 * This repo's iOS bundle id, read from app.json (expo.ios.bundleIdentifier)
 * so the tool picks Seli's dev client out of a simulator that also holds
 * other Expo dev clients. --bundle-id overrides it.
 */
function repoBundleId() {
  try {
    const appJson = JSON.parse(fs.readFileSync(new URL('../../app.json', import.meta.url), 'utf8'));
    return appJson?.expo?.ios?.bundleIdentifier;
  } catch {
    return undefined;
  }
}

/**
 * The Expo dev client on a device. A dev client registers an `exp+<slug>`
 * URL scheme (Expo Go uses plain `exp`), which is how we tell it apart.
 * `bundleId` (default: this repo's, from app.json) narrows the search when
 * a device has several dev clients.
 */
function findDevClient(d, bundleId = repoBundleId()) {
  const apps = installedApps(d).filter(
    (a) =>
      a.schemes.some((s) => s.startsWith('exp+')) &&
      (!bundleId || a.bundleId === bundleId),
  );
  if (apps.length === 1) {
    const a = apps[0];
    return { ...a, devClientScheme: a.schemes.find((s) => s.startsWith('exp+')) };
  }
  if (apps.length > 1) {
    throw new QaError(
      `"${d.name}" has several dev clients (${apps.map((a) => a.bundleId).join(', ')}); ` +
        'pass --bundle-id',
    );
  }
  return null;
}

function requireDevClient(d, bundleId) {
  const app = findDevClient(d, bundleId);
  if (!app) {
    throw new QaError(`no Expo dev client installed on "${d.name}"`);
  }
  return app;
}

// -----------------------------------------------------------------------------
// Commands
// -----------------------------------------------------------------------------

/** Exported for walk.mjs `step`: screenshot an owned device to a path. */
export function screenshot(ref, outPath) {
  const d = ownedDevice(ref);
  requireBooted(d);
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  simctl(['io', d.udid, 'screenshot', path.resolve(outPath)]);
  return path.resolve(outPath);
}

const commands = {
  /** QA devices on this machine (and, for cloning, devices with a dev client). */
  list() {
    const all = listDevices().filter((d) => d.isAvailable !== false);
    const mine = all.filter((d) => d.name.startsWith(QA_PREFIX));
    console.log('QA simulators:');
    if (!mine.length) console.log('  (none)');
    for (const d of mine) console.log(`  ${d.name}  ${d.udid}  ${d.state}`);
    console.log('\nShut-down devices with a dev client (clone sources):');
    let any = false;
    for (const d of all) {
      if (d.name.startsWith(QA_PREFIX) || d.state !== 'Shutdown') continue;
      const app = findDevClient(d);
      if (app) {
        any = true;
        console.log(`  ${d.name}  ${d.udid}  (${app.bundleId})`);
      }
    }
    if (!any) console.log('  (none)');
  },

  /**
   * Make a new QA simulator named "Seli QA <suffix>", either by cloning a
   * shut-down device that already has the dev client (fast, the default),
   * or by creating a blank one and installing a given .app (--app).
   */
  create(args, opts) {
    const suffix = args[0];
    if (!suffix) throw new QaError('usage: create <suffix> [--from <device>] | --app <App.app>');
    const name = QA_PREFIX + suffix;
    if (listDevices().some((d) => d.name === name)) {
      throw new QaError(`"${name}" already exists; tear it down or pick another suffix`);
    }

    if (opts.app) {
      // Blank device + install. Install needs a booted device.
      if (!fs.existsSync(path.join(opts.app, 'Info.plist'))) {
        throw new QaError(`${opts.app} is not an .app bundle (no Info.plist)`);
      }
      const udid = simctl(['create', name, opts['device-type'] || 'iPhone 17']);
      simctl(['boot', udid]);
      simctl(['bootstatus', udid]);
      simctl(['install', udid, path.resolve(opts.app)]);
      console.log(`created ${name} ${udid} (booted, ${opts.app} installed)`);
      console.log(udid);
      return;
    }

    // Clone. The source is only read; simctl requires it to be shut down.
    let src;
    if (opts.from) {
      src = resolveDevice(opts.from);
    } else {
      const cands = listDevices().filter(
        (d) =>
          d.isAvailable !== false &&
          d.state === 'Shutdown' &&
          !d.name.startsWith(QA_PREFIX) &&
          findDevClient(d, opts['bundle-id']),
      );
      if (!cands.length) {
        throw new QaError(
          'no shut-down simulator has the dev client; pass --from <device> or --app <App.app>',
        );
      }
      src = cands[0];
      console.log(`clone source: ${src.name} ${src.udid}`);
    }
    if (src.state !== 'Shutdown') {
      throw new QaError(
        `source "${src.name}" is ${src.state}; it is probably in use by another session. ` +
          'Pick a shut-down device (see `sim.mjs list`), never shut down someone else\'s.',
      );
    }
    requireDevClient(src, opts['bundle-id']);
    const udid = simctl(['clone', src.udid, name]);
    console.log(`created ${name} ${udid} (clone of ${src.name}, shut down)`);
    console.log(udid);
  },

  /** Boot with no Simulator window (simctl only; never `open -a Simulator`). */
  boot(args) {
    const d = ownedDevice(args[0]);
    if (d.state !== 'Booted') simctl(['boot', d.udid]);
    simctl(['bootstatus', d.udid]); // blocks until the device has finished booting
    console.log(`${d.name} booted (headless)`);
  },

  /** Bundle id, URL schemes and app path of the dev client on a device. */
  info(args, opts) {
    const d = resolveDevice(args[0]);
    const app = requireDevClient(d, opts['bundle-id']);
    console.log(JSON.stringify({ device: d.name, udid: d.udid, state: d.state, ...app }, null, 2));
  },

  /**
   * Pre-approve every URL scheme the dev client declares, so `simctl openurl`
   * opens the app directly instead of stopping at an "Open in <app>?" alert
   * (which a headless walk cannot tap).
   */
  'approve-schemes'(args, opts) {
    const d = ownedDevice(args[0]);
    requireBooted(d);
    const app = requireDevClient(d, opts['bundle-id']);
    for (const scheme of app.schemes) {
      simctl([
        'spawn',
        d.udid,
        'defaults',
        'write',
        'com.apple.launchservices.schemeapproval',
        `com.apple.CoreSimulator.CoreSimulatorBridge-->${scheme}`,
        '-string',
        app.bundleId,
      ]);
    }
    console.log(`approved ${app.schemes.join(', ')} for ${app.bundleId}`);
  },

  /**
   * (Re)launch the dev client pointed at YOUR Metro. Terminates first, so it
   * doubles as "relaunch after a crash". The app connects to 127.0.0.1, the
   * same host the walk driver uses.
   */
  'open-dev-client'(args, opts) {
    const d = ownedDevice(args[0]);
    requireBooted(d);
    if (!opts.port) throw new QaError('--port <metro-port> is required');
    const port = checkPort(opts.port);
    const app = requireDevClient(d, opts['bundle-id']);
    simctl(['terminate', d.udid, app.bundleId], { quiet: true }); // fine if not running
    const metro = encodeURIComponent(`http://127.0.0.1:${port}`);
    const url = `${app.devClientScheme}://expo-development-client/?url=${metro}`;
    simctl(['openurl', d.udid, url]);
    console.log(`opened ${url}`);
    console.log('Now confirm the bundle request ("iOS Bundled ...") appears in YOUR Metro log.');
  },

  /** Open a deep link, e.g. durintech://messages. */
  open(args) {
    const d = ownedDevice(args[0]);
    requireBooted(d);
    if (!args[1]) throw new QaError('usage: open <device> <url>');
    simctl(['openurl', d.udid, args[1]]);
    console.log(`opened ${args[1]}`);
  },

  screenshot(args) {
    if (!args[1]) throw new QaError('usage: screenshot <device> <path.png>');
    console.log(screenshot(args[0], args[1]));
  },

  /** Kill the app (for a cold start). */
  terminate(args, opts) {
    const d = ownedDevice(args[0]);
    requireBooted(d);
    const app = requireDevClient(d, opts['bundle-id']);
    simctl(['terminate', d.udid, app.bundleId], { quiet: true });
    console.log(`terminated ${app.bundleId}`);
  },

  /** Shut down and delete a QA simulator. Never touches the clone source. */
  teardown(args) {
    const d = ownedDevice(args[0]);
    if (d.state !== 'Shutdown') simctl(['shutdown', d.udid], { quiet: true });
    simctl(['delete', d.udid]);
    console.log(`deleted ${d.name} ${d.udid}`);
  },
};

// -----------------------------------------------------------------------------
// CLI entry (only when run directly, not when walk.mjs imports this file)
// -----------------------------------------------------------------------------

function main() {
  const { values: opts, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      from: { type: 'string' },
      app: { type: 'string' },
      'device-type': { type: 'string' },
      'bundle-id': { type: 'string' },
      port: { type: 'string', short: 'p', default: process.env.QA_METRO_PORT },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [cmd, ...rest] = positionals;
  if (!cmd || opts.help || !commands[cmd]) {
    // The header comment doubles as the usage text.
    const src = fs.readFileSync(new URL(import.meta.url), 'utf8');
    const usage = src.split('\n').filter((l) => l.startsWith(' *   node')).join('\n');
    console.log(`usage:\n${usage.replace(/^ \* {3}/gm, '  ')}`);
    process.exit(cmd && !commands[cmd] ? 1 : 0);
  }
  // Commands that take a device fall back to QA_UDID when the device
  // argument is left out (i.e. fewer positionals than the command takes).
  const arity = { open: 2, screenshot: 2, list: 0, create: 0 }[cmd] ?? 1;
  if (rest.length < arity && process.env.QA_UDID) {
    rest.unshift(process.env.QA_UDID);
  }
  commands[cmd](rest, opts);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    main();
  } catch (e) {
    if (e instanceof QaError || e.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}
