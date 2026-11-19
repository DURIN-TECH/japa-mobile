// Unit tests for scripts/e2e/lib/flows.mjs (japa#361): tag parsing, the tag
// rule, discovery of the real .maestro/flows and targeted selection.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  discoverFlows,
  parseFlowTags,
  selectFlows,
  tagProblems,
} from '../lib/flows.mjs';

const MAESTRO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '.maestro',
);

test('parseFlowTags reads block and inline lists from the config section only', () => {
  assert.deepEqual(
    parseFlowTags(
      'appId: x\ntags:\n  - auth\n  - flag-any\n---\n- tapOn: "tags:"\n',
    ),
    ['auth', 'flag-any'],
  );
  assert.deepEqual(parseFlowTags('appId: x\ntags: [flag, "flag-on"]\n---\n'), [
    'flag',
    'flag-on',
  ]);
  assert.deepEqual(parseFlowTags('appId: x\n---\ntags:\n  - auth\n'), []);
  assert.deepEqual(parseFlowTags('- tapOn: x\n'), []);
});

test('tagProblems: one area tag at least and exactly one flag tag', () => {
  assert.deepEqual(tagProblems(['auth', 'flag-any']), []);
  assert.deepEqual(tagProblems(['self-service', 'flag', 'flag-on']), []);
  assert.equal(tagProblems(['flag-on']).length, 1); // no area
  assert.equal(tagProblems(['auth']).length, 1); // no flag tag
  assert.equal(tagProblems(['auth', 'flag-on', 'flag-off']).length, 1); // two flag tags
});

test('the repo flows all follow the tag rule', () => {
  const flows = discoverFlows(MAESTRO);
  assert.ok(flows.length >= 6);
  for (const f of flows) assert.deepEqual(tagProblems(f.tags), [], f.rel);
});

test('discoverFlows refuses a mis-tagged flow and duplicate names', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-flows-'));
  fs.mkdirSync(path.join(dir, 'flows', 'a'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'flows', 'b'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'flows', 'a', 'x.yaml'),
    'appId: a\ntags:\n  - auth\n---\n',
  );
  assert.throws(() => discoverFlows(dir), /flag tag/);
  fs.writeFileSync(
    path.join(dir, 'flows', 'a', 'x.yaml'),
    'appId: a\ntags: [auth, flag-any]\n---\n',
  );
  fs.writeFileSync(
    path.join(dir, 'flows', 'b', 'x.yaml'),
    'appId: a\ntags: [flag, flag-on]\n---\n',
  );
  assert.throws(() => discoverFlows(dir), /share the file name/);
  fs.rmSync(dir, { recursive: true });
});

test('selectFlows: all, by tag (any of), by path, unknowns refused', () => {
  const flows = discoverFlows(MAESTRO);
  assert.equal(selectFlows(flows).length, flows.length);
  const auth = selectFlows(flows, { tags: ['auth'] });
  assert.ok(auth.length >= 2 && auth.every((f) => f.tags.includes('auth')));
  const onOrAuth = selectFlows(flows, { tags: ['auth', 'flag-on'] });
  assert.ok(
    onOrAuth.every(
      (f) => f.tags.includes('auth') || f.tags.includes('flag-on'),
    ),
  );
  // flag-any first, then flag-off, then flag-on.
  const order = selectFlows(flows).map((f) => f.flag);
  assert.deepEqual(
    order,
    [...order].sort(
      (a, b) =>
        ['flag-any', 'flag-off', 'flag-on'].indexOf(a) -
        ['flag-any', 'flag-off', 'flag-on'].indexOf(b),
    ),
  );
  const one = selectFlows(flows, {
    files: [path.join(MAESTRO, 'flows', 'auth', 'sign-in.yaml')],
  });
  assert.deepEqual(
    one.map((f) => f.rel),
    ['flows/auth/sign-in.yaml'],
  );
  assert.throws(
    () => selectFlows(flows, { tags: ['nope'] }),
    /no flow has the tag/,
  );
  assert.throws(
    () =>
      selectFlows(flows, {
        files: [path.join(MAESTRO, 'subflows', 'launch.yaml')],
      }),
    /not a suite flow/,
  );
});
