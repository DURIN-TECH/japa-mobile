// ─────────────────────────────────────────────────────────────────────────────
// settingsLogic (japa#346): the version footer and the Legal / Support links.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it, jest } from '@jest/globals';
import {
  SETTINGS_LINKS,
  openSettingsLink,
  versionLabel,
} from '../settingsLogic';

describe('versionLabel', () => {
  it('present → "Version <x>"', () => {
    expect(versionLabel('1.0.0')).toBe('Version 1.0.0');
    expect(versionLabel('2.3.4')).toBe('Version 2.3.4');
  });
  it('absent / empty / not a string → null (line left out)', () => {
    expect(versionLabel(undefined)).toBeNull();
    expect(versionLabel(null)).toBeNull();
    expect(versionLabel('')).toBeNull();
    expect(versionLabel('  ')).toBeNull();
    expect(versionLabel(3)).toBeNull();
  });
});

describe('openSettingsLink', () => {
  it('opened → true', async () => {
    const openURL = jest.fn<(url: string) => Promise<boolean>>(
      async () => true,
    );
    await expect(
      openSettingsLink({ openURL }, SETTINGS_LINKS.privacy.url),
    ).resolves.toBe(true);
    expect(openURL).toHaveBeenCalledWith('https://weareseli.com/privacy');
  });
  it('openURL rejects → false, never throws', async () => {
    const openURL = jest.fn<(url: string) => Promise<boolean>>(async () => {
      throw new Error('No app');
    });
    await expect(
      openSettingsLink({ openURL }, SETTINGS_LINKS.contact.url),
    ).resolves.toBe(false);
  });
});

describe('SETTINGS_LINKS failure copy', () => {
  it('each message shows the address without its scheme', () => {
    for (const { url, failure } of Object.values(SETTINGS_LINKS)) {
      const address = url.replace(/^https:\/\/|^mailto:/, '');
      expect(failure).toContain(address);
      expect(failure).not.toMatch(/https:|mailto:/);
    }
  });
});
