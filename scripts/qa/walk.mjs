#!/usr/bin/env node
/*
 * scripts/qa/walk.mjs — drive the running app headless, through Metro.
 *
 * Connects to the app's Hermes runtime through Metro's inspector proxy
 * (Chrome DevTools Protocol, `Runtime.evaluate`), installs the helpers in
 * ./agent.js and runs one command. No screen control, no finger taps: it
 * reads what React actually rendered and calls the handlers a tap or a
 * keystroke would end in. See ./README.md for the recipe and its limits.
 *
 *   node scripts/qa/walk.mjs targets                 inspector targets on this Metro
 *   node scripts/qa/walk.mjs dump [--all]            route, stack, rendered text + labels
 *   node scripts/qa/walk.mjs route                   route + stack only
 *   node scripts/qa/walk.mjs nav                     full navigation state (JSON)
 *   node scripts/qa/walk.mjs press <text|label> [--index n] [--exact] [--force]
 *   node scripts/qa/walk.mjs pressables              everything with an onPress
 *   node scripts/qa/walk.mjs fill <label|placeholder> <value> [--index n]
 *   node scripts/qa/walk.mjs inputs                  text fields and their values
 *   node scripts/qa/walk.mjs wait-for <text> [--timeout ms]
 *   node scripts/qa/walk.mjs eval <js> | --file <script.js>
 *   node scripts/qa/walk.mjs step <name> --udid <device> --out <dir>
 *
 * Options (env fallback in brackets):
 *   -p, --port <n>      YOUR Metro's port [QA_METRO_PORT]; required, no default;
 *                       8081-8083 refused
 *   --udid <device>     your simulator [QA_UDID]. When set, only a target from
 *                       that simulator is accepted (and `step` screenshots it)
 *   -d, --device <s>    pick the target whose device name contains <s> [QA_DEVICE]
 *   -t, --target <id>   pick a target by its inspector page id
 *   --out <dir>         where `step` writes <name>.png/.txt [QA_OUT]; required for
 *                       `step` (use your scratchpad, never the repo)
 *   --all               include mounted screens that are not focused
 *   --timeout <ms>      per-call timeout, default 20000
 *   --json              print raw JSON results
 *
 * Node 24 built-ins only (global fetch + WebSocket); no npm install needed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { QaError, checkPort, deviceName, screenshot } from './sim.mjs';

// The in-app helper source, sent before every command (see agent.js header).
const AGENT_SRC = fs.readFileSync(new URL('./agent.js', import.meta.url), 'utf8');

// -----------------------------------------------------------------------------
// Picking the inspector target
// -----------------------------------------------------------------------------

/** Metro's list of debuggable pages; clear errors when Metro or the app is missing. */
async function listTargets(port) {
  let res;
  try {
    res = await fetch(`http://127.0.0.1:${port}/json/list`);
  } catch {
    throw new QaError(
      `nothing is listening on 127.0.0.1:${port}. Start YOUR Metro on that port ` +
        '(see scripts/qa/README.md), or pass --port.',
    );
  }
  if (!res.ok) throw new QaError(`Metro on :${port} answered /json/list with HTTP ${res.status}`);
  return res.json();
}

function describe(t) {
  return `  id=${t.id}  device="${t.deviceName ?? '?'}"  ${t.title ?? ''}  [${t.description ?? ''}]`;
}

/**
 * Which physical/simulated device a target belongs to. Metro gives each
 * device a stable logical id; fall back to the name if it's missing. Two
 * simulators that share a name still count as two devices.
 */
function deviceKey(t) {
  return (t.reactNative && t.reactNative.logicalDeviceId) || `name:${t.deviceName}`;
}

/**
 * Choose one target. Several apps (or several pages of one app) can be
 * attached to the same Metro; we never guess between DEVICES, because
 * driving the wrong one would be driving someone else's walk.
 *
 * `expectedName` (from --udid / QA_UDID) is the guard against attaching to
 * another session's Metro: only targets from that simulator are accepted.
 * Metro's target list carries the device NAME (not the UDID), so we compare
 * names; `sim.mjs create` makes names unique per session ("Seli QA <issue>").
 */
function pickTarget(list, opts, expectedName) {
  if (!list.length) {
    throw new QaError(
      'Metro is up but no app is attached. Open the dev client on this port ' +
        '(`sim.mjs open-dev-client <device> --port <port>`) and wait for "iOS Bundled" in the Metro log.',
    );
  }
  let cands = list;
  if (expectedName) {
    cands = cands.filter((x) => x.deviceName === expectedName);
    if (!cands.length) {
      throw new QaError(
        `no app from your simulator "${expectedName}" is attached to the Metro on this port. ` +
          'This Metro may belong to another session: check --port / QA_METRO_PORT. ' +
          `Attached:\n${list.map(describe).join('\n')}`,
      );
    }
  }
  if (opts.target) {
    const t = cands.find((x) => String(x.id) === String(opts.target));
    if (!t) throw new QaError(`no target with id ${opts.target}. Targets:\n${cands.map(describe).join('\n')}`);
    return t;
  }
  if (opts.device) {
    cands = cands.filter((x) => `${x.deviceName ?? ''} ${x.title ?? ''}`.includes(opts.device));
    if (!cands.length) {
      throw new QaError(`no target on a device matching "${opts.device}". Targets:\n${list.map(describe).join('\n')}`);
    }
  }
  // Count devices BEFORE preferring a page type, so a second device that
  // only lists a non-Bridgeless page still triggers the refusal.
  const devices = new Set(cands.map(deviceKey));
  if (devices.size > 1) {
    throw new QaError(
      `several devices are attached to this Metro; pass --udid, --device or --target:\n${cands.map(describe).join('\n')}`,
    );
  }
  // One device. Its new-architecture page is "React Native Bridgeless
  // [C++ connection]"; prefer it over legacy/experimental entries.
  const bridgeless = cands.filter((x) => String(x.description ?? '').includes('Bridgeless'));
  return (bridgeless.length ? bridgeless : cands)[0];
}

// -----------------------------------------------------------------------------
// CDP session
// -----------------------------------------------------------------------------

/**
 * One WebSocket to the target, any number of evaluate() calls.
 *
 * GOTCHA: the Origin header must be exactly `http://127.0.0.1:<port>`. With
 * `http://localhost:<port>` Metro accepts the socket and then drops the
 * session at once ("Debugger ... disconnected" in its log, no replies).
 */
async function connect(target, port, timeoutMs) {
  const ws = new WebSocket(target.webSocketDebuggerUrl, {
    headers: { Origin: `http://127.0.0.1:${port}` },
  });
  const pending = new Map();
  let nextId = 1;
  let closed = false;

  const dropped = () =>
    new QaError(
      'the debugger connection closed before the app answered. If the app crashed ' +
        '(a crash inside hermes::vm::Debugger is the driver, not the app), relaunch it ' +
        'with `sim.mjs terminate` then `sim.mjs open-dev-client --port <port>`, and redo the step.',
    );

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new QaError('timed out opening the debugger socket')), timeoutMs);
    ws.addEventListener('open', () => {
      clearTimeout(timer);
      resolve();
    });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new QaError(`could not open the debugger socket ${target.webSocketDebuggerUrl}`));
    });
  });

  ws.addEventListener('message', (ev) => {
    let msg;
    try {
      msg = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    const p = pending.get(msg.id);
    if (p) {
      pending.delete(msg.id);
      p.resolve(msg);
    }
  });
  ws.addEventListener('close', () => {
    closed = true;
    for (const p of pending.values()) p.reject(dropped());
    pending.clear();
  });

  /** Evaluate `expression` in the app; returns its JSON value. */
  async function evaluate(expression) {
    if (closed) throw dropped();
    const id = nextId++;
    const reply = new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (pending.delete(id)) reject(new QaError(`no reply from the app within ${timeoutMs} ms`));
      }, timeoutMs);
    });
    ws.send(
      JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression, returnByValue: true, awaitPromise: true },
      }),
    );
    const msg = await reply;
    if (msg.error) throw new QaError(`CDP error: ${JSON.stringify(msg.error)}`);
    const r = msg.result;
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      const text = (d.exception && (d.exception.description || d.exception.value)) || d.text;
      throw new QaError(`exception in the app: ${String(text).slice(0, 800)}`);
    }
    return r.result.value;
  }

  /** Install the agent and evaluate `code` in the same round trip. */
  function run(code) {
    return evaluate(`${AGENT_SRC}\n;${code}`);
  }

  return { evaluate, run, close: () => ws.close() };
}

// -----------------------------------------------------------------------------
// "Did you mean" for press/fill misses
// -----------------------------------------------------------------------------

function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Closest candidates: case-insensitive containment first, then edit distance. */
export function nearMatches(query, candidates, max = 8) {
  const q = query.toLowerCase();
  return candidates
    .map((c) => {
      const l = c.toLowerCase();
      if (l.includes(q) || q.includes(l)) return { c, s: 0 };
      // Compare against the start of long strings so a short query is not
      // drowned by a paragraph's length.
      const head = l.slice(0, q.length + 8);
      return { c, s: levenshtein(q, head) / Math.max(q.length, head.length, 1) };
    })
    .filter((x) => x.s < 0.6)
    .sort((a, b) => a.s - b.s)
    .slice(0, max)
    .map((x) => x.c);
}

// -----------------------------------------------------------------------------
// Output helpers
// -----------------------------------------------------------------------------

function dumpText(d) {
  return [`ROUTE: ${d.route}`, `STACK: ${d.stack}`, ...d.lines].join('\n');
}

function print(value, asJson) {
  if (asJson || typeof value !== 'string') console.log(JSON.stringify(value, null, 2));
  else console.log(value);
}

/** Turn a failed press/fill result into a QaError with hints. */
function explainMiss(kind, query, r) {
  if (r.reason === 'not-found' && kind === 'press') {
    const near = nearMatches(query, r.candidates || []);
    return new QaError(
      `nothing on the focused screen reads or is labelled "${query}".` +
        (near.length ? `\nNear matches:\n${near.map((n) => `  ${n}`).join('\n')}` : '') +
        '\n(Lists only mount visible rows; scroll via `eval` or try --all for unfocused screens.)',
    );
  }
  if (r.reason === 'not-found' && kind === 'fill') {
    const rows = (r.inputs || []).map(
      (i) => `  placeholder=${JSON.stringify(i.placeholder)} label=${JSON.stringify(i.label)} testID=${JSON.stringify(i.testID)}`,
    );
    return new QaError(
      `no text field with a placeholder, label or testID containing "${query}".` +
        (rows.length ? `\nFields on screen:\n${rows.join('\n')}` : '\nNo text fields on the focused screen.'),
    );
  }
  if (r.reason === 'index-out-of-range') {
    return new QaError(`--index is past the last match (${JSON.stringify(r.matches)})`);
  }
  if (r.reason === 'disabled') {
    return new QaError(`"${r.text}" is disabled (${r.via}); a tap would do nothing. --force to call it anyway.`);
  }
  if (r.reason === 'no-onpress') return new QaError(`"${r.text}" is on screen but nothing above it handles a press`);
  return new QaError(`${kind} failed: ${JSON.stringify(r)}`);
}

// -----------------------------------------------------------------------------
// Commands
// -----------------------------------------------------------------------------

const commands = {
  async status(s) {
    return s.run('__qa.status()');
  },

  async dump(s, args, o) {
    const d = await s.run(`__qa.dump(${!!o.all})`);
    return o.json ? d : dumpText(d);
  },

  async route(s, args, o) {
    const d = await s.run('({ route: __qa.path(), stack: __qa.stack() })');
    return o.json ? d : `ROUTE: ${d.route}\nSTACK: ${d.stack}`;
  },

  async nav(s) {
    return s.run('__qa.nav()');
  },

  async press(s, args, o) {
    const query = args[0];
    if (!query) throw new QaError('usage: press <text|label>');
    const opts = { index: Number(o.index || 0), exact: !!o.exact, all: !!o.all, force: !!o.force };
    const r = await s.run(`__qa.press(${JSON.stringify(query)}, ${JSON.stringify(opts)})`);
    if (!r.ok) throw explainMiss('press', query, r);
    return o.json ? r : `pressed "${r.text}" via ${r.via} (match ${r.index + 1} of ${r.matches})`;
  },

  async pressables(s, args, o) {
    const r = await s.run(`__qa.pressables(${!!o.all})`);
    return o.json ? r : r.join('\n');
  },

  async fill(s, args, o) {
    const [query, value] = args;
    if (!query || value === undefined) throw new QaError('usage: fill <label|placeholder> <value>');
    const opts = { index: Number(o.index || 0), all: !!o.all };
    const r = await s.run(`__qa.fill(${JSON.stringify(query)}, ${JSON.stringify(value)}, ${JSON.stringify(opts)})`);
    if (!r.ok) throw explainMiss('fill', query, r);
    return o.json ? r : `filled "${query}" via ${r.via} (match ${r.index + 1} of ${r.matches})`;
  },

  async inputs(s, args, o) {
    return s.run(`__qa.inputs(${!!o.all})`);
  },

  /** Poll the focused screen until a line contains <text> (e.g. after a fetch). */
  async 'wait-for'(s, args, o, timeoutMs) {
    const query = args[0];
    if (!query) throw new QaError('usage: wait-for <text>');
    const until = Date.now() + timeoutMs;
    let last;
    while (Date.now() < until) {
      last = await s.run(`__qa.dump(${!!o.all})`);
      if (last.lines.some((l) => l.includes(query))) return o.json ? last : dumpText(last);
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new QaError(`"${query}" did not appear within ${timeoutMs} ms. Last screen:\n${last ? dumpText(last) : '(none)'}`);
  },

  /**
   * Run arbitrary JS in the app, with __qa available. The value of the last
   * expression is printed. Top-level const/let persist between calls and
   * clash on the next one: wrap multi-line code in an IIFE.
   */
  async eval(s, args, o) {
    const code = o.file ? fs.readFileSync(o.file, 'utf8') : args.join(' ');
    if (!code.trim()) throw new QaError('usage: eval <js>  |  eval --file <script.js>');
    return s.run(code);
  },

  /** Screenshot + dump, saved as <out>/<name>.png and <out>/<name>.txt. */
  async step(s, args, o) {
    const name = args[0];
    if (!name) throw new QaError('usage: step <name> --udid <device> --out <dir>');
    if (!o.udid) throw new QaError('step needs --udid <device> (or QA_UDID) for the screenshot');
    // No default: evidence belongs in the walker's scratchpad, not the repo.
    if (!o.out) throw new QaError('step needs --out <dir> (or QA_OUT); use a scratch folder, not the repo');
    const out = path.resolve(o.out);
    fs.mkdirSync(out, { recursive: true });
    const d = await s.run('__qa.dump(false)');
    const png = screenshot(o.udid, path.join(out, `${name}.png`));
    const text = dumpText(d);
    fs.writeFileSync(path.join(out, `${name}.txt`), `${text}\n`);
    return `${text}\n\n(saved ${png} and ${name}.txt)`;
  },
};

// -----------------------------------------------------------------------------
// Entry
// -----------------------------------------------------------------------------

function usage() {
  const src = fs.readFileSync(new URL(import.meta.url), 'utf8');
  const header = src.split('*/')[0].split('\n').slice(2);
  return header.map((l) => l.replace(/^ \* ?/, '')).join('\n');
}

async function main() {
  const { values: o, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      // No default port on purpose: a default would let two sessions'
      // walks both reach for it and one end up driving the other's app.
      port: { type: 'string', short: 'p', default: process.env.QA_METRO_PORT },
      device: { type: 'string', short: 'd', default: process.env.QA_DEVICE },
      target: { type: 'string', short: 't' },
      udid: { type: 'string', default: process.env.QA_UDID },
      out: { type: 'string', default: process.env.QA_OUT },
      file: { type: 'string' },
      index: { type: 'string' },
      timeout: { type: 'string', default: '20000' },
      all: { type: 'boolean' },
      exact: { type: 'boolean' },
      force: { type: 'boolean' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [cmd, ...args] = positionals;
  if (!cmd || o.help) {
    console.log(usage());
    return;
  }
  if (!o.port) {
    throw new QaError(
      'no Metro port: pass --port <n> or export QA_METRO_PORT (the port YOUR Metro runs on, >= 8084)',
    );
  }
  const port = checkPort(o.port);
  const timeoutMs = Number(o.timeout);

  const list = await listTargets(port);
  if (cmd === 'targets') {
    console.log(list.length ? list.map(describe).join('\n') : '(no app attached)');
    return;
  }
  if (!commands[cmd]) throw new QaError(`unknown command "${cmd}" (try --help)`);

  // With --udid / QA_UDID, resolve the simulator's name to guard the target.
  const expectedName = o.udid ? deviceName(o.udid) : null;
  const target = pickTarget(list, o, expectedName);
  if (!expectedName) {
    // No UDID to check against: say on every command which device we drive,
    // on stderr so --json output stays clean, so a wrong attachment shows.
    console.error(`(attached to "${target.deviceName}", target ${target.id}, Metro :${port}; set QA_UDID to enforce)`);
  }
  const session = await connect(target, port, timeoutMs);
  try {
    print(await commands[cmd](session, args, o, timeoutMs), o.json);
  } finally {
    session.close();
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    if (e instanceof QaError || e.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' || e.code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE') {
      console.error(`error: ${e.message}`);
    } else {
      console.error(e);
    }
    process.exit(1);
  },
);
