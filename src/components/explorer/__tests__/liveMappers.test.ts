// ─────────────────────────────────────────────────────────────────────────────
// Unit tests: the live mappers touched by japa#145 (live only).
//   • liveProfile     — real name / city header, name only without a city
//   • liveEligibility — backend questions + scored check, no static result
//   • liveExplore     — visa → Dest art comes from the assets module
//   • liveAgencies    — agency cover/tone from the assets module, slug kept
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import {
  profileCity,
  profileHeader,
  profileName,
  profileSeed,
} from '../liveProfile';
import {
  GENERIC_SUMMARY,
  mapCheckResult,
  mapQuestion,
} from '../liveEligibility';
import {
  mapRequirements,
  mapVisasToDests,
  visaTypeToDest,
} from '../liveExplore';
import { mapAgency } from '../liveAgencies';
import { agencyCover, agencyTone, countryImage } from '@/assets/countries';
import type { VisaType, VisaRequirement } from '@/types/visas.type';
import type { EligibilityQuestion } from '@/types/eligibility.type';
import type { ApiAgency } from '@/hooks/useAgencies';

// ── liveProfile ──────────────────────────────────────────────────────────────

describe('liveProfile', () => {
  const ada = {
    id: 'u1',
    firstName: 'Ada ',
    lastName: 'Obi',
    address: {
      street: '',
      city: 'Lagos',
      state: '',
      postalCode: '',
      country: 'NG',
    },
  };

  it('builds "Name · City" from the profile', () => {
    expect(profileName(ada)).toBe('Ada Obi');
    expect(profileCity(ada)).toBe('Lagos');
    expect(profileHeader(ada)).toBe('Ada Obi · Lagos');
  });

  it('shows the name only when the city is missing (no separator)', () => {
    expect(profileHeader({ ...ada, address: undefined })).toBe('Ada Obi');
    expect(
      profileHeader({ ...ada, address: { ...ada.address, city: '  ' } }),
    ).toBe('Ada Obi');
  });

  it('is empty for a missing profile or name, never a persona', () => {
    expect(profileHeader(null)).toBe('');
    expect(profileHeader(undefined)).toBe('');
    expect(profileHeader({ id: 'u2' })).toBe('');
    expect(profileName({ firstName: 'Ada' })).toBe('Ada');
  });

  it('derives a stable portrait seed in 0–5', () => {
    expect(profileSeed(ada)).toBe(profileSeed(ada));
    expect(profileSeed(ada)).toBeGreaterThanOrEqual(0);
    expect(profileSeed(ada)).toBeLessThan(6);
    expect(profileSeed(null)).toBe(0);
  });
});

// ── liveEligibility ──────────────────────────────────────────────────────────

const q = (over: Partial<EligibilityQuestion>): EligibilityQuestion =>
  ({
    id: 'q1',
    scope: 'visa',
    question: 'Do you have a job offer?',
    type: 'boolean',
    weight: 1,
    ...over,
  }) as EligibilityQuestion;

describe('liveEligibility.mapQuestion', () => {
  it('keeps the four renderable types', () => {
    for (const t of ['boolean', 'single', 'multiple', 'number'] as const) {
      expect(mapQuestion(q({ type: t })).type).toBe(t);
    }
  });

  it('maps date/text to single with options, else number', () => {
    expect(
      mapQuestion(q({ type: 'text' as never, options: ['a', 'b'] })).type,
    ).toBe('single');
    expect(mapQuestion(q({ type: 'date' as never })).type).toBe('number');
  });

  it('prefers helpText over description and passes bounds through', () => {
    const m = mapQuestion(
      q({
        type: 'number',
        helpText: 'help',
        description: 'desc',
        minValue: 0,
        maxValue: 40,
        unit: 'years',
      }),
    );
    expect(m).toMatchObject({ help: 'help', min: 0, max: 40, unit: 'years' });
    expect(mapQuestion(q({ description: 'desc' })).help).toBe('desc');
  });
});

describe('liveEligibility.mapCheckResult', () => {
  const breakdown = [
    { question: 'Qualification', passed: true },
    { question: 'Funds', passed: false },
  ] as never;

  it('maps the real score, verdict and matched / gaps', () => {
    const r = mapCheckResult({
      score: 82,
      eligibilityLevel: 'high',
      breakdown,
      missingRequirements: [],
      recommendations: ['Upload proof of funds.'],
    });
    expect(r).toEqual({
      score: 82,
      verdict: 'Likely eligible',
      summary: 'Upload proof of funds.',
      matched: ['Qualification'],
      gaps: ['Funds'],
    });
  });

  it('prefers explicit missing requirements and a generic summary', () => {
    const r = mapCheckResult({
      score: 40,
      eligibilityLevel: 'low',
      breakdown,
      missingRequirements: ['Police record'],
      recommendations: [],
    });
    expect(r.gaps).toEqual(['Police record']);
    expect(r.summary).toBe(GENERIC_SUMMARY.low);
  });

  it('clamps the score and survives a missing breakdown', () => {
    const r = mapCheckResult({
      score: 140,
      eligibilityLevel: 'medium',
      breakdown: undefined as never,
      missingRequirements: undefined as never,
      recommendations: undefined as never,
    });
    expect(r.score).toBe(100);
    expect(r.matched).toEqual([]);
    expect(r.gaps).toEqual([]);
  });
});

// ── liveExplore ──────────────────────────────────────────────────────────────

const visa = (over: Partial<VisaType> = {}): VisaType =>
  ({
    id: 'gb-sw',
    countryCode: 'GB',
    name: 'Skilled Worker',
    code: 'SW',
    description: 'Work in the UK',
    category: 'work',
    processingTime: '3 weeks',
    processingDaysMin: 15,
    processingDaysMax: 21,
    baseCostUsd: 719.6,
    validityPeriod: '5 years',
    isExtendable: true,
    eligibilityCriteria: [],
    isActive: true,
    agentIds: [],
    totalApplications: 10,
    ...over,
  }) as VisaType;

describe('liveExplore', () => {
  it('dresses a known country from the assets module', () => {
    const d = visaTypeToDest(visa(), 'United Kingdom');
    expect(d.img).toBe(countryImage('gb'));
    expect(d.city).toBe('London');
    expect(d.flag).toBe('gb');
    expect(d.cat).toBe('Work');
    expect(d.price).toBe(720);
  });

  it('uses the default skyline and no city for an unknown country', () => {
    const d = visaTypeToDest(visa({ countryCode: 'NG' }));
    expect(d.img).toBe(countryImage('zz-unknown'));
    expect(d.city).toBe('');
    expect(d.country).toBe('NG');
  });

  it('features the most-applied route and resolves country names', () => {
    const dests = mapVisasToDests(
      [visa({ id: 'a' }), visa({ id: 'b', totalApplications: 99 })],
      [{ code: 'GB', name: 'United Kingdom' } as never],
    );
    expect(dests.map((d) => d.featured)).toEqual([undefined, true]);
    expect(dests[0].country).toBe('United Kingdom');
    expect(mapVisasToDests([], [])).toEqual([]);
  });

  it('orders requirements and never invents rows', () => {
    const reqs = [
      { title: 'B', description: 'b', orderIndex: 2, estimatedTime: '' },
      { title: 'A', description: 'a', orderIndex: 1, estimatedTime: '1 wk' },
    ] as VisaRequirement[];
    expect(mapRequirements(reqs)).toEqual([
      { t: 'A', d: 'a', e: '1 wk' },
      { t: 'B', d: 'b', e: 'See details' },
    ]);
    expect(mapRequirements([])).toEqual([]);
  });
});

// ── liveAgencies.mapAgency ───────────────────────────────────────────────────

describe('liveAgencies.mapAgency', () => {
  const agency = {
    id: 'ag-123',
    slug: 'pathway',
    name: 'Pathway',
    ownerName: 'Owner',
    services: [],
    agentCount: 3,
    totalCases: 0,
    status: 'approved',
    verified: true,
    createdAt: { _seconds: 1700000000, _nanoseconds: 0 },
  } as ApiAgency;

  it('takes cover + tone from the assets module and keeps the slug', () => {
    const a = mapAgency(agency);
    expect(a.cover).toBe(agencyCover('ag-123'));
    expect(a.tone).toBe(agencyTone('ag-123'));
    expect(a.slug).toBe('pathway');
    expect(a.agents).toBe(3);
    expect(a.est).toBe(2023);
  });

  it('has no slug when the backend sends none', () => {
    expect(mapAgency({ ...agency, slug: undefined }).slug).toBeUndefined();
  });
});
