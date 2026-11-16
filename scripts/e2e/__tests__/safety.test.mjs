// Unit tests for scripts/e2e/lib/safety.mjs (japa#361): the .secret.local
// rules (never overwrite a file with other values), local-host checks, the
// email switch check and the clean environment.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  DUMMY_SECRET,
  assertEmulatorHosts,
  cutOffEnv,
  emailSwitchProblems,
  fakeServiceAccount,
  isLocalHostPort,
  planSecretFile,
  secretFileContent,
} from '../lib/safety.mjs';

const declared = ['ANTHROPIC_API_KEY', 'PAYSTACK_SECRET_KEY', 'RESEND_API_KEY'];

test('planSecretFile: write when missing, reuse our complete dummy file', () => {
  assert.deepEqual(planSecretFile(null, declared), { action: 'write' });
  assert.deepEqual(planSecretFile(secretFileContent(declared), declared), {
    action: 'reuse',
  });
});

test('planSecretFile: refuses any non-dummy value and an incomplete file', () => {
  const real = `ANTHROPIC_API_KEY=sk-ant-real\nPAYSTACK_SECRET_KEY=${DUMMY_SECRET}\nRESEND_API_KEY=${DUMMY_SECRET}\n`;
  const r = planSecretFile(real, declared);
  assert.equal(r.action, 'refuse');
  assert.match(r.reason, /ANTHROPIC_API_KEY/);
  assert.doesNotMatch(r.reason, /sk-ant-real/); // never echoes a value
  const partial = `ANTHROPIC_API_KEY=${DUMMY_SECRET}\n`;
  assert.equal(planSecretFile(partial, declared).action, 'refuse');
});

test('secretFileContent has one dummy line per declared secret', () => {
  const lines = secretFileContent(declared)
    .split('\n')
    .filter((l) => l && !l.startsWith('#'));
  assert.deepEqual(
    lines,
    declared.map((k) => `${k}=${DUMMY_SECRET}`),
  );
});

test('isLocalHostPort / assertEmulatorHosts accept only this machine', () => {
  for (const ok of ['127.0.0.1:19603', 'localhost:19605', 'http://127.0.0.1:1'])
    assert.ok(isLocalHostPort(ok), ok);
  for (const bad of [
    'firestore.googleapis.com:443',
    '10.0.0.2:8080',
    '127.0.0.1',
    '',
    undefined,
  ]) {
    assert.ok(!isLocalHostPort(bad), String(bad));
  }
  assert.throws(
    () => assertEmulatorHosts({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:1' }),
    /FIREBASE_AUTH_EMULATOR_HOST/,
  );
  assert.doesNotThrow(() =>
    assertEmulatorHosts({
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:1',
      FIREBASE_AUTH_EMULATOR_HOST: 'localhost:2',
      FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:3',
    }),
  );
});

test('emailSwitchProblems flags EMAIL_SENDING_ENABLED in the env files the emulator loads', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-fn-'));
  assert.deepEqual(emailSwitchProblems(dir), []);
  fs.writeFileSync(path.join(dir, '.env.durin-seli-dev'), 'APP_URL=x\n');
  fs.writeFileSync(
    path.join(dir, '.env.local'),
    'EMAIL_SENDING_ENABLED=true\n',
  );
  assert.deepEqual(emailSwitchProblems(dir), [
    '.env.local: EMAIL_SENDING_ENABLED=true',
  ]);
  fs.rmSync(dir, { recursive: true });
});

test('cutOffEnv drops inherited credentials and points everything local', () => {
  const env = cutOffEnv(
    {
      PATH: '/bin',
      HOME: '/h',
      FIREBASE_TOKEN: 'tok',
      ANTHROPIC_API_KEY: 'k',
      GOOGLE_APPLICATION_CREDENTIALS: '/real.json',
    },
    { credentials: '/tmp/fake.json', cloudsdk: '/tmp/g', xdg: '/tmp/x' },
    { firestore: 19603, auth: 19605, storage: 19606 },
  );
  assert.equal(env.FIREBASE_TOKEN, undefined);
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
  assert.equal(env.GOOGLE_APPLICATION_CREDENTIALS, '/tmp/fake.json');
  assert.equal(env.CLOUDSDK_CONFIG, '/tmp/g');
  assert.equal(env.XDG_CONFIG_HOME, '/tmp/x');
  assert.equal(env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:19603');
  assert.match(env.HTTPS_PROXY, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.match(env.NO_PROXY, /localhost/);
  assert.equal(env.PATH, '/bin');
});

test('fakeServiceAccount has an unreachable local token_uri', () => {
  const sa = fakeServiceAccount();
  assert.match(sa.token_uri, /^http:\/\/127\.0\.0\.1:9\//);
  assert.match(sa.private_key, /BEGIN PRIVATE KEY/);
});
