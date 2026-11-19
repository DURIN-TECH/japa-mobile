/*
 * scripts/e2e/lib/proc.mjs — long-running child processes for the e2e
 * runner (japa#361): the emulators and Metro.
 *
 * Each is spawned DETACHED (its own process group) with stdout+stderr going
 * to a log file, so the runner can (a) wait for a line in its log and (b)
 * stop it and everything it started (java emulators, Metro workers) by
 * signalling the whole group. Stopping is synchronous so it also works from
 * a SIGINT / SIGTERM handler. Only groups this module started are signalled.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

/** Synchronous sleep (cleanup runs in signal handlers, no event loop). */
export function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Starts `cmd args` in cwd with env, logging to logFile.
 * Returns { child, pid, logFile, exited } (exited: null | exit code/signal).
 */
export function startLogged(name, cmd, args, { cwd, env, logFile }) {
  const fd = fs.openSync(logFile, 'a');
  const child = spawn(cmd, args, {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', fd, fd],
  });
  fs.closeSync(fd);
  const proc = { name, child, pid: child.pid, logFile, exited: null };
  child.on('exit', (code, signal) => {
    proc.exited = code ?? signal ?? 'exited';
  });
  child.on('error', (e) => {
    proc.exited = `failed to start: ${e.message}`;
  });
  return proc;
}

/** The log's text so far ('' when missing). */
export function readLog(proc) {
  try {
    return fs.readFileSync(proc.logFile, 'utf8');
  } catch {
    return '';
  }
}

/** The last n lines of a process's log, for error messages. */
export function logTail(proc, n = 30) {
  return readLog(proc).split('\n').slice(-n).join('\n');
}

/**
 * Waits until check(logText) is truthy (returns its value), polling.
 * Throws when the process exits first or the timeout passes.
 */
export async function waitForLog(
  proc,
  check,
  { timeoutMs, what, pollMs = 500 },
) {
  const start = Date.now();
  for (;;) {
    const hit = check(readLog(proc));
    if (hit) return hit;
    if (proc.exited !== null) {
      throw new Error(
        `${proc.name} exited (${proc.exited}) before ${what}:\n${logTail(proc)}`,
      );
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${what}:\n${logTail(proc)}`,
      );
    }
    await sleep(pollMs);
  }
}

/** Whether a process group still has members. */
function groupAlive(pgid) {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

/**
 * Stops a process this module started, with its whole group: SIGINT (lets
 * the emulators shut down cleanly), then SIGTERM, then SIGKILL. Synchronous.
 * Returns true when the group is gone.
 */
export function stopGroup(proc, { graceMs = 15_000 } = {}) {
  if (!proc?.pid) return true;
  const steps = [
    ['SIGINT', graceMs],
    ['SIGTERM', 5_000],
    ['SIGKILL', 3_000],
  ];
  for (const [sig, wait] of steps) {
    if (!groupAlive(proc.pid)) return true;
    try {
      process.kill(-proc.pid, sig);
    } catch {
      // already gone
    }
    const until = Date.now() + wait;
    while (Date.now() < until && groupAlive(proc.pid)) sleepSync(250);
  }
  return !groupAlive(proc.pid);
}
