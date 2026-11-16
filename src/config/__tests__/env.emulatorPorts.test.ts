// ─────────────────────────────────────────────────────────────────────────────
// japa#361: emulator ports come from EXPO_PUBLIC_EMULATOR_AUTH_PORT /
// EXPO_PUBLIC_EMULATOR_FUNCTIONS_PORT (baked into expo `extra` by
// app.config.ts). Unset, they stay at the firebase.json defaults 9099 / 5001,
// so existing set-ups are unchanged; set, the Auth emulator URL and the
// Functions API base both follow them (the Maestro e2e runner relies on it).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it, jest } from '@jest/globals';

type Extra = Record<string, unknown>;

/**
 * Loads a fresh copy of `@/config/env` with the given expo `extra`. env.ts
 * reads `extra` at import time, so each case needs its own module instance.
 */
function loadEnv(extra: Extra): typeof import('@/config/env') {
  let mod: typeof import('@/config/env') | undefined;
  jest.isolateModules(() => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra } },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@/config/env');
  });
  if (!mod) throw new Error('env did not load');
  return mod;
}

describe('emulator ports', () => {
  it('keep the firebase.json defaults (9099 / 5001) when unset', () => {
    const env = loadEnv({ useEmulator: true, emulatorProjectId: 'japa-platform' });
    expect(env.AUTH_EMULATOR_PORT).toBe(9099);
    expect(env.FUNCTIONS_EMULATOR_PORT).toBe(5001);
    expect(env.AUTH_EMULATOR_URL).toBe('http://localhost:9099');
    expect(env.API_URL).toBe(
      'http://localhost:5001/japa-platform/us-central1/api',
    );
  });

  it('use the baked ports when set (the e2e runner case)', () => {
    const env = loadEnv({
      useEmulator: true,
      emulatorProjectId: 'durin-seli-dev',
      emulatorAuthPort: '19605',
      emulatorFunctionsPort: '19602',
    });
    expect(env.AUTH_EMULATOR_URL).toBe('http://localhost:19605');
    expect(env.API_URL).toBe(
      'http://localhost:19602/durin-seli-dev/us-central1/api',
    );
  });

  it('leave the deployed API alone when the emulator is off', () => {
    const env = loadEnv({
      useEmulator: false,
      apiUrl: 'https://us-central1-durin-seli-dev.cloudfunctions.net/api',
      emulatorFunctionsPort: '19602',
    });
    expect(env.API_URL).toBe(
      'https://us-central1-durin-seli-dev.cloudfunctions.net/api',
    );
  });
});

describe('emulatorPort', () => {
  const { emulatorPort } = loadEnv({});
  it.each([
    [undefined, 9099],
    [null, 9099],
    ['', 9099],
    ['  ', 9099],
    ['abc', 9099],
    ['19605x', 9099],
    ['-1', 9099],
    ['0', 9099],
    ['65536', 9099],
    ['1.5', 9099],
    ['19605', 19605],
    [' 19605 ', 19605],
    [19605, 19605],
    ['65535', 65535],
  ])('%p → %p', (raw, expected) => {
    expect(emulatorPort(raw as string | number | undefined | null, 9099)).toBe(
      expected,
    );
  });
});
