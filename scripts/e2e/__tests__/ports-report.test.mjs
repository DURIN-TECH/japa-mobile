// Unit tests for scripts/e2e/lib/ports.mjs and lib/report.mjs (japa#361).
import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';

import {
  checkMetroPort,
  emulatorPorts,
  isPortFree,
  pickMetroPort,
} from '../lib/ports.mjs';
import { formatSummary, parseJunit, summarise } from '../lib/report.mjs';

test('checkMetroPort refuses 8081-8083 and nonsense, accepts others', () => {
  for (const p of [8081, 8082, 8083, 'x', 80, 70000])
    assert.throws(() => checkMetroPort(p));
  assert.equal(checkMetroPort('8090'), 8090);
});

test('emulatorPorts lists every port incl. the Firestore websocket', () => {
  const ports = emulatorPorts({
    emulators: {
      hub: { port: 19600 },
      firestore: { port: 19603, websocketPort: 19604 },
      ui: { enabled: false },
      singleProjectMode: true,
    },
  });
  assert.deepEqual(
    ports.map((p) => p.port),
    [19600, 19603, 19604],
  );
});

test('isPortFree sees a listener; pickMetroPort skips it', async () => {
  const srv = net.createServer();
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const { port } = srv.address();
  assert.equal(await isPortFree(port), false);
  const picked = await pickMetroPort(port, port + 20);
  assert.notEqual(picked, port);
  await new Promise((r) => srv.close(r));
});

const XML = `<?xml version="1.0"?>
<testsuites><testsuite name="Test Suite" tests="2" failures="1">
<testcase id="sign-in" name="sign-in" classname="sign-in" time="12.5" status="SUCCESS"/>
<testcase id="flag-on" name="flag-on" classname="flag-on" time="80.0" status="ERROR"><failure>Element not found: Id matching regex: tab\\.agents</failure></testcase>
</testsuite></testsuites>`;

test('parseJunit + summarise: pass, fail, missing', () => {
  const cases = parseJunit(XML);
  assert.deepEqual(
    cases.map((c) => [c.name, c.passed, c.seconds]),
    [
      ['sign-in', true, 12.5],
      ['flag-on', false, 80],
    ],
  );
  const flows = [
    {
      file: '/x/flows/auth/sign-in.yaml',
      rel: 'flows/auth/sign-in.yaml',
      flag: 'flag-any',
    },
    {
      file: '/x/flows/flag/flag-on.yaml',
      rel: 'flows/flag/flag-on.yaml',
      flag: 'flag-on',
    },
    {
      file: '/x/flows/flag/flag-off.yaml',
      rel: 'flows/flag/flag-off.yaml',
      flag: 'flag-off',
    },
  ];
  const rows = summarise(flows, cases);
  assert.deepEqual(
    rows.map((r) => r.passed),
    [true, false, false],
  );
  const text = formatSummary(rows, 100);
  assert.match(text, /1\/3 passed/);
  assert.match(text, /flows\/flag\/flag-on\.yaml\s+flag-on\s+FAIL/);
});
