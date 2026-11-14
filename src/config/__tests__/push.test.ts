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
