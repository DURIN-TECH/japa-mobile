/*
 * scripts/e2e/lib/ports.mjs — port rules for the e2e runner (japa#361).
 *
 * This machine is shared: other sessions run Metro on 8081-8083, QA walks
 * use 8084-8089, and developers run the emulators on the firebase.json
 * defaults. The runner therefore
 *   - never uses 8081-8083 for its Metro, nor any port that is taken;
 *   - picks the first free Metro port from 8090 when none is given;
 *   - stops, naming the port, when any emulator port from
 *     firebase.e2e.json is taken (it never reuses a process it did not start).
 */
import { execFileSync } from 'node:child_process';
import net from 'node:net';

/** Other sessions' Metro servers. Never ours, whatever is asked. */
export const RESERVED_METRO_PORTS = [8081, 8082, 8083];
/** QA walks (team process) use these; the default search skips them. */
export const QA_WALK_PORTS = [8084, 8085, 8086, 8087, 8088, 8089];
export const DEFAULT_METRO_FROM = 8090;
export const DEFAULT_METRO_TO = 8199;

/**
 * Checks a requested Metro port against the fixed rules (not whether it is
 * free). Returns the number; throws with the reason otherwise.
 */
export function checkMetroPort(raw) {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(
      `invalid Metro port: ${raw} (use a number from 1024 to 65535)`,
    );
  }
  if (RESERVED_METRO_PORTS.includes(port)) {
    throw new Error(
      `Metro port ${port} belongs to another session (8081-8083 are never used by the e2e runner)`,
    );
  }
  return port;
}

/**
 * Every port the e2e emulator suite will bind, from firebase.e2e.json's
 * `emulators` block: each emulator's `port`, plus the Firestore websocket.
 * Returns [{ name, port }] sorted by port.
 */
export function emulatorPorts(firebaseJson) {
  const em = firebaseJson?.emulators ?? {};
  const out = [];
  for (const [name, cfg] of Object.entries(em)) {
    if (!cfg || typeof cfg !== 'object') continue;
    if (Number.isInteger(cfg.port)) out.push({ name, port: cfg.port });
    if (Number.isInteger(cfg.websocketPort)) {
      out.push({ name: `${name} websocket`, port: cfg.websocketPort });
    }
  }
  return out.sort((a, b) => a.port - b.port);
}

/** PIDs listening on a TCP port (lsof; [] when none or lsof is missing). */
export function listeners(port) {
  try {
    const out = execFileSync(
      'lsof',
      ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number);
  } catch {
    return []; // lsof exits 1 when nothing matches
  }
}

/** Whether we can bind host:port right now (closes it again at once). */
function canBind(port, host) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', (e) => {
      // An address family the machine lacks (no IPv6) is not "taken".
      resolve(e.code === 'EADDRNOTAVAIL' || e.code === 'EAFNOSUPPORT');
    });
    srv.listen({ port, host, exclusive: true }, () =>
      srv.close(() => resolve(true)),
    );
  });
}

/**
 * True when nothing listens on the port: no lsof listener and it binds on
 * both 127.0.0.1 and ::1 (servers here bind one or the other).
 */
export async function isPortFree(port) {
  if (listeners(port).length) return false;
  return (await canBind(port, '127.0.0.1')) && (await canBind(port, '::1'));
}

/** First free Metro port in [from, to]; throws when none is. */
export async function pickMetroPort(
  from = DEFAULT_METRO_FROM,
  to = DEFAULT_METRO_TO,
) {
  for (let p = from; p <= to; p++) {
    if (RESERVED_METRO_PORTS.includes(p)) continue;
    if (await isPortFree(p)) return p;
  }
  throw new Error(`no free Metro port between ${from} and ${to}`);
}
