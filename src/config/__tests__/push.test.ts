/// <reference types="node" />
// These tests read repo files with `fs` / `path` (Node, under Jest). Jest 29
// pulled the Node types in by accident through `@jest/globals`; Jest 30
// (Expo SDK 58, japa#399) does not, so this file asks for them itself. Kept
// per-file so app code does not see Node globals.
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { ANDROID_PUSH_CHANNEL_ID } from '../push';

// The Android channel id is duplicated in the config plugin (plain CommonJS,
// cannot import TS). This guards the two copies, and the backend contract
// (japa#267: "default"), from drifting apart.
describe('ANDROID_PUSH_CHANNEL_ID', () => {
  it('is the id agreed with the backend', () => {
    expect(ANDROID_PUSH_CHANNEL_ID).toBe('default');
  });

  it('matches the channel the config plugin creates', () => {
    const plugin = fs.readFileSync(
      path.join(__dirname, '../../../plugins/withAndroidPushSetup.js'),
      'utf8',
    );
    expect(plugin).toContain(
      `const CHANNEL_ID = '${ANDROID_PUSH_CHANNEL_ID}';`,
    );
  });
});
