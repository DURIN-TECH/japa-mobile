/// <reference types="node" />
// These tests read repo files with `fs` / `path` (Node, under Jest). Jest 29
// pulled the Node types in by accident through `@jest/globals`; Jest 30
// (Expo SDK 58, japa#399) does not, so this file asks for them itself. Kept
// per-file so app code does not see Node globals.
// ─────────────────────────────────────────────────────────────────────────────
// Self-service-only build flag (japa#334): the parser, the copy of its rule in
// app.config.ts, and which EAS profiles turn it on.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { isSelfServiceOnlyFlag } from '../selfServiceOnly';

const ROOT = path.join(__dirname, '../../..');

describe('isSelfServiceOnlyFlag', () => {
  it('is on only for "true", case and surrounding spaces ignored', () => {
    expect(isSelfServiceOnlyFlag('true')).toBe(true);
    expect(isSelfServiceOnlyFlag('TRUE')).toBe(true);
    expect(isSelfServiceOnlyFlag(' true ')).toBe(true);
  });

  it('is off for unset, empty and every other value', () => {
    expect(isSelfServiceOnlyFlag(undefined)).toBe(false);
    expect(isSelfServiceOnlyFlag('')).toBe(false);
    expect(isSelfServiceOnlyFlag('false')).toBe(false);
    expect(isSelfServiceOnlyFlag('1')).toBe(false);
    expect(isSelfServiceOnlyFlag('yes')).toBe(false);
  });
});

// app.config.ts cannot import the TS parser, so it repeats the rule. Guard the
// copy from drifting (same idea as the push channel id test).
describe('app.config.ts', () => {
  it('bakes extra.selfServiceOnly with the same rule as the parser', () => {
    const config = fs.readFileSync(path.join(ROOT, 'app.config.ts'), 'utf8');
    expect(config.replace(/\s+/g, ' ')).toContain(
      "selfServiceOnly: process.env.EXPO_PUBLIC_SELF_SERVICE_ONLY?.trim().toLowerCase() === 'true'",
    );
  });
});

describe('eas.json build profiles', () => {
  const eas = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'),
  ) as { build: Record<string, { env?: Record<string, string> }> };
  const flag = (profile: string) =>
    eas.build[profile]?.env?.EXPO_PUBLIC_SELF_SERVICE_ONLY;

  it('turns the flag on for the store / TestFlight profiles', () => {
    expect(isSelfServiceOnlyFlag(flag('production'))).toBe(true);
    expect(isSelfServiceOnlyFlag(flag('tester'))).toBe(true);
  });

  it('leaves it off for development, ios-simulator and preview', () => {
    // ios-simulator extends development, so it has no env of its own.
    for (const profile of ['development', 'ios-simulator', 'preview']) {
      expect(isSelfServiceOnlyFlag(flag(profile))).toBe(false);
    }
  });
});
