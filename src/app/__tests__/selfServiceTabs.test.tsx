// ─────────────────────────────────────────────────────────────────────────────
// Tab bar in a self-service-only build (japa#334): four tabs with the flag on
// (no Agents), all five with it off, in the same order as before.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from '@jest/globals';
import { visibleTabs } from '../(tabs)/_layout';

describe('visibleTabs', () => {
  it('flag on: Home, Explore, Tracker, Profile (no Agents)', () => {
    expect(visibleTabs(true).map((t) => t.label)).toEqual([
      'Home',
      'Explore',
      'Tracker',
      'Profile',
    ]);
  });

  it('flag off: all five tabs, as today', () => {
    expect(visibleTabs(false).map((t) => t.label)).toEqual([
      'Home',
      'Explore',
      'Tracker',
      'Agents',
      'Profile',
    ]);
  });
});
