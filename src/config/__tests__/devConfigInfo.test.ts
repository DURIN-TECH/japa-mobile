// ─────────────────────────────────────────────────────────────────────────────
// japa#330: pure builder for the dev-only "App configuration" screen.
// Checks formatting, warnings (project mismatch, expired token), update
// states, signed-out state, and that the share text never carries a token.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from '@jest/globals';
import {
  buildDevConfigSections,
  devConfigToText,
  type DevConfigSources,
} from '@/config/devConfigInfo';

const base: DevConfigSources = {
  appEnv: 'development',
  apiUrl: 'https://us-central1-durin-seli-dev.cloudfunctions.net/api',
  firebaseProjectId: 'durin-seli-dev',
  nativeFirebaseProjectId: 'durin-seli-dev',
  nativeFirebaseAppId: '1:123:ios:abc',
  useEmulator: false,
  emulatorHost: 'localhost',
  emulatorProjectId: 'japa-platform',
  feedbackEnabled: true,
  appVersion: '1.0.0',
  buildNumber: '42',
  bundleId: 'com.durintech.japamobile',
  updatesEnabled: true,
  updateChannel: 'development',
  runtimeVersion: '1.0.0',
  updateId: 'u-1',
  isEmbeddedLaunch: false,
  bundleSource: 'http://localhost:8081/index.bundle',
  isDevBuild: true,
  os: 'ios',
  osVersion: '26.5',
  deviceName: 'iPhone 17',
  user: {
    uid: 'uid-1',
    email: 'delivered+x@resend.dev',
    emailVerified: true,
    role: 'client',
    tokenExpiresAt: '2026-11-15T12:30:00.000Z',
  },
};
const NOW = new Date('2026-11-15T12:00:00.000Z');
const row = (secs: ReturnType<typeof buildDevConfigSections>, label: string) =>
  secs.flatMap((s) => s.rows).find((r) => r.label === label);

describe('buildDevConfigSections', () => {
  it('shows the effective environment values', () => {
    const s = buildDevConfigSections(base, NOW);
    expect(s.map((x) => x.title)).toEqual([
      'Environment',
      'Build',
      'Signed in as',
      'Device',
    ]);
    expect(row(s, 'API server')?.value).toBe(base.apiUrl);
    expect(row(s, 'Local emulators')?.value).toBe('off');
    expect(row(s, 'Role (token)')?.value).toBe('client');
    expect(row(s, 'Token expires')?.value).toMatch(/in 30 min/);
    expect(row(s, 'Token expires')?.warn).toBe(false);
    expect(row(s, 'Running update')?.value).toBe('u-1');
  });

  it('flags a native Firebase project that differs from the config', () => {
    const s = buildDevConfigSections(
      { ...base, nativeFirebaseProjectId: 'japa-platform' },
      NOW,
    );
    expect(row(s, 'Firebase project (native)')?.warn).toBe(true);
  });

  it('describes emulator mode, embedded launches and disabled updates', () => {
    const emu = buildDevConfigSections(
      { ...base, useEmulator: true, isEmbeddedLaunch: true },
      NOW,
    );
    expect(row(emu, 'Local emulators')?.value).toBe(
      'on · localhost · japa-platform',
    );
    expect(row(emu, 'Running update')?.value).toBe('embedded (no update)');
    const off = buildDevConfigSections({ ...base, updatesEnabled: false }, NOW);
    expect(row(off, 'Running update')?.value).toBe('updates off');
  });

  it('flags an expired token', () => {
    const s = buildDevConfigSections(
      {
        ...base,
        user: { ...base.user!, tokenExpiresAt: '2026-11-15T11:00:00.000Z' },
      },
      NOW,
    );
    expect(row(s, 'Token expires')?.value).toMatch(/expired/);
    expect(row(s, 'Token expires')?.warn).toBe(true);
  });

  it('handles signed-out and missing values without crashing', () => {
    const s = buildDevConfigSections(
      {
        ...base,
        user: null,
        nativeFirebaseProjectId: undefined,
        updateChannel: null,
      },
      NOW,
    );
    expect(row(s, 'User')?.value).toBe('not signed in');
    expect(row(s, 'Firebase project (native)')?.value).toBe('unavailable');
    expect(row(s, 'Firebase project (native)')?.warn).toBe(false);
    expect(row(s, 'Update channel')?.value).toBe('none');
  });
});

describe('devConfigToText', () => {
  it('produces a pasteable block with headings and warnings', () => {
    const text = devConfigToText(
      buildDevConfigSections(
        { ...base, nativeFirebaseProjectId: 'japa-platform' },
        NOW,
      ),
    );
    expect(text).toContain('## Environment');
    expect(text).toContain('API server: ' + base.apiUrl);
    expect(text).toContain('Firebase project (native): japa-platform  ⚠️');
    // No token material is ever part of the snapshot.
    expect(text).not.toMatch(/eyJ|Bearer/);
  });
});

// japa#375: the self-service-only flag's effective value and its source.
describe('self-service-only row', () => {
  const value = (over: Partial<DevConfigSources>) =>
    row(buildDevConfigSections({ ...base, ...over }, NOW), 'Self-service only')
      ?.value;

  it('shows the build value', () => {
    expect(
      value({ selfServiceOnly: false, selfServiceOnlySource: 'build' }),
    ).toBe('off · build');
  });

  it('shows an override and the build value it replaces', () => {
    expect(
      value({
        selfServiceOnly: true,
        selfServiceOnlySource: 'override',
        selfServiceOnlyBuild: false,
      }),
    ).toBe('on · override (build: off)');
  });

  it('is "unavailable" when not collected', () => {
    expect(value({})).toBe('unavailable');
  });
});
