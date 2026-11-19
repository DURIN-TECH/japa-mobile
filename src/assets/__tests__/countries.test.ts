// ─────────────────────────────────────────────────────────────────────────────
// Unit tests: country & location imagery assets module (japa#145).
// Known codes keep the exact photos the Explorer showed before; unknown codes
// get the default skyline; lookups are case-insensitive and never throw.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import {
  COUNTRY_ART,
  DEFAULT_COUNTRY_IMG_ID,
  DEFAULT_COUNTRY_TONE,
  IMG,
  agencyCover,
  agencyTone,
  countryCity,
  countryFlag,
  countryImage,
  countryTone,
  flagUrl,
} from '../countries';

/** The ten codes the issue says must keep their photos. */
const KNOWN = ['gb', 'us', 'ca', 'au', 'jp', 'de', 'fr', 'ae', 'ie', 'nl'];

describe('URL helpers', () => {
  it('IMG builds a sized Unsplash URL', () => {
    expect(IMG('abc', 400)).toBe(
      'https://images.unsplash.com/photo-abc?auto=format&fit=crop&w=400&q=80',
    );
    expect(IMG('abc')).toContain('w=900');
  });

  it('flagUrl lower-cases the code', () => {
    expect(flagUrl('GB')).toBe('https://flagcdn.com/w160/gb.png');
    expect(flagUrl('ng', 80)).toBe('https://flagcdn.com/w80/ng.png');
  });
});

describe('countryImage', () => {
  it('has art for every required code', () => {
    for (const code of KNOWN) expect(COUNTRY_ART[code]).toBeDefined();
  });

  it('keeps the photos the Explorer showed before', () => {
    // Spot-check against the ids the old COUNTRY_META / DESTS used.
    expect(countryImage('gb')).toBe(IMG('1513635269975-59663e0ac1ad'));
    expect(countryImage('us')).toBe(IMG('1496442226666-8d4d0e62e6e9'));
    expect(countryImage('ae')).toBe(IMG('1512453979798-5ea266f8880c'));
  });

  it('is case- and whitespace-insensitive', () => {
    expect(countryImage('GB')).toBe(countryImage('gb'));
    expect(countryImage(' gb ')).toBe(countryImage('gb'));
  });

  it('falls back to the default skyline for unknown or missing codes', () => {
    const fallback = IMG(DEFAULT_COUNTRY_IMG_ID);
    expect(countryImage('ng')).toBe(fallback);
    expect(countryImage('')).toBe(fallback);
    expect(countryImage(undefined)).toBe(fallback);
    expect(countryImage(null)).toBe(fallback);
    // Prototype keys must not be treated as countries.
    expect(countryImage('constructor')).toBe(fallback);
  });

  it('passes the width through', () => {
    expect(countryImage('gb', 300)).toContain('w=300');
    expect(countryImage('ng', 300)).toContain('w=300');
  });
});

describe('countryFlag', () => {
  it('returns a flagcdn URL for any code, known or not', () => {
    expect(countryFlag('GB')).toBe('https://flagcdn.com/w160/gb.png');
    expect(countryFlag('ng', 40)).toBe('https://flagcdn.com/w40/ng.png');
  });
});

describe('countryCity / countryTone', () => {
  it('returns the display city and tone for known codes', () => {
    expect(countryCity('gb')).toBe('London');
    expect(countryCity('NL')).toBe('Amsterdam');
    expect(countryTone('us')).toBe('#2A3A52');
  });

  it('returns no city and the default tone for unknown codes', () => {
    expect(countryCity('ng')).toBe('');
    expect(countryCity(undefined)).toBe('');
    expect(countryTone('ng')).toBe(DEFAULT_COUNTRY_TONE);
  });
});

describe('agency covers', () => {
  it('is stable per id and always a valid image + tone', () => {
    expect(agencyCover('agency-1')).toBe(agencyCover('agency-1'));
    expect(agencyTone('agency-1')).toBe(agencyTone('agency-1'));
    expect(agencyCover('agency-1')).toMatch(/^https:\/\/images\.unsplash\.com/);
    expect(agencyTone('')).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
