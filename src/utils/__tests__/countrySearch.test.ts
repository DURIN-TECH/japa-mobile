// Country search helpers (japa#254): alias / code / name resolution and the
// de-duplicating merge. Pure functions, no network.

import { describe, expect, it } from '@jest/globals';
import {
  MAX_COUNTRY_MATCHES,
  matchCountries,
  mergeSearchVisas,
  normalizeQuery,
} from '../countrySearch';
import type { Country } from '@/types/country.type';
import type { VisaType } from '@/types/visas.type';

const c = (code: string, name: string): Country => ({
  code,
  name,
  isSupported: true,
  visaTypesCount: 1,
  minProcessingDays: 1,
  minCostUsd: 1,
});

const COUNTRIES = [
  c('GB', 'United Kingdom'),
  c('US', 'United States'),
  c('IE', 'Ireland'),
  c('AT', 'Austria'),
  c('RU', 'Russia'),
  c('CA', 'Canada'),
];

const codes = (q: string) => matchCountries(q, COUNTRIES).map((x) => x.code);
const visa = (id: string, countryCode = 'GB') =>
  ({ id, countryCode }) as unknown as VisaType;

describe('normalizeQuery', () => {
  it('lower-cases, strips dots and collapses spaces', () => {
    expect(normalizeQuery('  U.K. ')).toBe('uk');
    expect(normalizeQuery('Great   Britain')).toBe('great britain');
  });
});

describe('matchCountries', () => {
  it('matches full names', () => {
    expect(codes('United Kingdom')).toEqual(['GB']);
    expect(codes('Ireland')).toEqual(['IE']);
  });

  it('resolves aliases to the same country', () => {
    for (const q of ['UK', 'Britain', 'Great Britain', 'England', 'u.k.']) {
      expect(codes(q)).toEqual(['GB']);
    }
    for (const q of ['US', 'USA', 'America']) {
      expect(codes(q)).toEqual(['US']);
    }
  });

  it('resolves country codes case-insensitively', () => {
    expect(codes('gb')).toEqual(['GB']);
    expect(codes('GB')).toEqual(['GB']);
    expect(codes('ie')).toEqual(['IE']);
  });

  it('matches partial names from 2 characters', () => {
    expect(codes('ire')).toEqual(['IE']);
    expect(codes('ir')).toEqual(['IE']);
    expect(codes('kingdom')).toEqual(['GB']);
  });

  it('does not match mid-word text ("us" is not Austria / Russia)', () => {
    expect(codes('us')).toEqual(['US']);
  });

  it('needs 2 characters and returns nothing for no match', () => {
    expect(codes('i')).toEqual([]);
    expect(codes('')).toEqual([]);
    expect(codes('zzz')).toEqual([]);
  });

  it('ignores an alias whose country is not loaded', () => {
    expect(matchCountries('uk', [c('IE', 'Ireland')])).toEqual([]);
  });

  it('caps the number of matched countries', () => {
    const many = Array.from({ length: 12 }, (_, i) => c(`X${i}`, `Xland ${i}`));
    expect(matchCountries('xl', many)).toHaveLength(MAX_COUNTRY_MATCHES);
  });
});

describe('mergeSearchVisas', () => {
  it('lists a visa once when both the name and its country match', () => {
    const merged = mergeSearchVisas(
      [visa('a'), visa('b')],
      [visa('b'), visa('c')],
    );
    expect(merged.map((v) => v.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns country visas when there are no name matches, and [] when neither', () => {
    expect(mergeSearchVisas([], [visa('c')])).toHaveLength(1);
    expect(mergeSearchVisas([], [])).toEqual([]);
  });
});
