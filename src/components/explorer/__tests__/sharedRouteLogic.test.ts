// Pure helpers for shared routes (japa#237, P8a). Names in fixtures are
import { describe, expect, it } from '@jest/globals';
// placeholders ("Alpha", "Beta"), never real countries.
import {
  alsoCoversPillLabel,
  answersWithoutFrom,
  buildSharedStartInput,
  canShowChangeCountry,
  changeCountryError,
  classifySharedStartError,
  choiceNote,
  ctaState,
  hasMoreCovers as hasMore,
  initialSelection,
  layerLabel,
  missingLayerNote,
  otherCovers,
  sheetState,
  showRoutePill,
  unknownNote,
  visibleCovers,
} from '../sharedRouteLogic';
import type { ApplyThroughView, StackLayer } from '@/types/sharedRoute.type';

const cov = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    countryCode: `C${i}`,
    countryName: `Name ${i}`,
  }));

const opt = (code: string, name: string) => ({
  countryCode: code,
  countryName: name,
  visaTypeId: `v-${code}`,
  visaTypeName: 'Route visa',
  baseCostUsd: 100,
});

const view = (over: Partial<ApplyThroughView> = {}): ApplyThroughView => ({
  sharedRoute: { id: 'r', name: 'Route' },
  available: true,
  message: null,
  options: [opt('AA', 'Alpha'), opt('BB', 'Beta')],
  questions: [],
  competence: { steps: [] },
  result: { status: 'unknown', reason: 'NO_STEP_APPLIES', why: '' },
  proposal: null,
  answers: {},
  ...over,
});

const proposal = {
  countryCode: 'AA',
  countryName: 'Alpha',
  stepIndex: 0,
  restsOn: 'x',
  quote: 'q',
  url: 'u',
  offered: true,
};

describe('covers list', () => {
  it('leaves this country out, case-blind', () => {
    const r = { id: 'r', name: 'R', covers: cov(3) };
    expect(otherCovers(r, 'c1').map((c) => c.countryCode)).toEqual([
      'C0',
      'C2',
    ]);
  });
  it('shows six then all', () => {
    const o = cov(8);
    expect(visibleCovers(o, false)).toHaveLength(6);
    expect(visibleCovers(o, true)).toHaveLength(8);
    expect(hasMore(o)).toBe(true);
    expect(hasMore(cov(6))).toBe(false);
  });
  it('row pill counts others, singular for one, null for none', () => {
    expect(alsoCoversPillLabel({ id: 'r', name: 'R', covers: cov(3) })).toBe(
      'Also covers 2 other countries',
    );
    expect(alsoCoversPillLabel({ id: 'r', name: 'R', covers: cov(2) })).toBe(
      'Also covers 1 other country',
    );
    expect(
      alsoCoversPillLabel({ id: 'r', name: 'R', covers: cov(1) }),
    ).toBeNull();
    expect(alsoCoversPillLabel(null)).toBeNull();
  });
});

describe('sheet state, proposal and choice note', () => {
  it('unavailable without options or when not available', () => {
    expect(sheetState(view({ options: [] }), false)).toBe('unavailable');
    expect(sheetState(view({ available: false }), false)).toBe('unavailable');
  });
  it('ask until answered or skipped', () => {
    const v = view({ result: { status: 'ask', questionId: 'q1' } });
    expect(sheetState(v, false)).toBe('ask');
    expect(sheetState(v, true)).toBe('list');
  });
  it('proposal only when offered; otherwise the plain list', () => {
    expect(sheetState(view({ proposal }), false)).toBe('proposal');
    expect(
      sheetState(view({ proposal: { ...proposal, offered: false } }), false),
    ).toBe('list');
    expect(sheetState(view(), false)).toBe('list');
  });
  it('preselects the proposal, never a default in a plain list', () => {
    const v = view({ proposal });
    expect(initialSelection(v, 'proposal', 'start')).toBe('AA');
    expect(initialSelection(view(), 'list', 'start')).toBeNull();
    expect(initialSelection(v, 'proposal', 'change', 'bb')).toBe('BB');
  });
  it('note only when the choice differs from the proposal', () => {
    const v = view({ proposal });
    expect(choiceNote(v, 'AA', 'proposal')).toBeNull();
    expect(choiceNote(v, 'BB', 'proposal')).toBe(
      'The rule points to Alpha. You chose Beta. We’ll keep a note that this was your choice.',
    );
    expect(choiceNote(view(), 'BB', 'list')).toBeNull();
  });
  it('unknown note keeps `why` only when present', () => {
    const base =
      'We can’t tell from your answers which country the rule points to.';
    expect(unknownNote(view())).toBe(base);
    expect(
      unknownNote(
        view({ result: { status: 'unknown', reason: 'x', why: 'Because.' } }),
      ),
    ).toBe(`${base} Because.`);
  });
  it('cta labels', () => {
    const a = opt('AA', 'Alpha');
    expect(ctaState('start', null, null)).toEqual({
      label: 'Choose a country',
      disabled: true,
    });
    expect(ctaState('start', a, null)).toEqual({
      label: 'Apply through Alpha',
      disabled: false,
    });
    expect(ctaState('change', a, 'aa')).toEqual({
      label: 'Applying through Alpha',
      disabled: true,
    });
    expect(ctaState('change', a, 'BB')).toEqual({
      label: 'Change to Alpha',
      disabled: false,
    });
  });
  it('changing an answer clears it and the later ones', () => {
    const qs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as never[];
    expect(answersWithoutFrom(qs, { a: 'x', b: 'y', c: 'z' }, 'b')).toEqual({
      a: 'x',
    });
  });
});

describe('create / change bodies and errors', () => {
  it('start body sends the shared route, not the visa', () => {
    expect(
      buildSharedStartInput({ sharedRouteId: 'r', throughCountryCode: 'aa' }),
    ).toEqual({ sharedRouteId: 'r', throughCountryCode: 'AA', mode: 'self' });
    expect(
      buildSharedStartInput({
        sharedRouteId: 'r',
        throughCountryCode: 'aa',
        competenceAnswers: { q: 'v' },
        confirmNew: true,
      }),
    ).toMatchObject({ competenceAnswers: { q: 'v' }, confirmNew: true });
  });
  it('classifies the 422 country errors apart from the rest', () => {
    expect(
      classifySharedStartError({ status: 422, code: 'COUNTRY_NOT_OFFERED' }),
    ).toBe('country');
    expect(classifySharedStartError({ status: 402 })).toBe('upgrade');
    expect(classifySharedStartError({ status: 404 })).toBe('unavailable');
    expect(classifySharedStartError({ status: 500 })).toBe('retry');
  });
  it('change errors use the backend message after payment', () => {
    expect(changeCountryError({ code: 'ALREADY_PAID', message: 'Paid.' })).toBe(
      'Paid.',
    );
    expect(changeCountryError({ code: 'ALREADY_PAID' })).toBe(
      'You can’t change the country after you’ve paid.',
    );
    expect(changeCountryError({ code: 'NETWORK_ERROR' })).toMatch(
      /couldn’t change/,
    );
  });
});

describe('application header', () => {
  it('change country only when the backend flag is true', () => {
    expect(
      canShowChangeCountry({ routeName: 'R', canChangeThroughCountry: true }),
    ).toBe(true);
    expect(
      canShowChangeCountry({ routeName: 'R', canChangeThroughCountry: false }),
    ).toBe(false);
    expect(canShowChangeCountry({ routeName: 'R' })).toBe(false);
    expect(canShowChangeCountry({ canChangeThroughCountry: true })).toBe(false);
  });
  it('route pill only when it differs from the visa name', () => {
    expect(showRoutePill({ routeName: 'R' }, 'Visa')).toBe(true);
    expect(showRoutePill({ routeName: 'Visa' }, 'Visa')).toBe(false);
    expect(showRoutePill({}, 'Visa')).toBe(false);
  });
});

describe('layer labels', () => {
  const layers: StackLayer[] = [
    { key: 's', kind: 'shared', name: 'R', status: 'ready' },
    {
      key: 'c',
      kind: 'country',
      countryCode: 'AA',
      countryName: 'Alpha',
      status: 'missing',
    },
  ];
  it('maps shared and country layers', () => {
    expect(layerLabel(layers, 's')).toMatchObject({
      kind: 'shared',
      text: 'Shared rules',
    });
    expect(layerLabel(layers, 'c')).toMatchObject({
      kind: 'country',
      text: 'Rules for Alpha',
      a11y: 'From the rules for Alpha',
    });
  });
  it('never labels a single-layer rulebook, a missing key or an unknown key', () => {
    expect(layerLabel(undefined, 's')).toBeNull();
    expect(layerLabel([layers[0]], 's')).toBeNull();
    expect(layerLabel(layers, undefined)).toBeNull();
    expect(layerLabel(layers, 'zzz')).toBeNull();
  });
  it('missing-layer note names what is left out', () => {
    expect(missingLayerNote(layers)).toBe(
      'Part of the rules is not ready yet, so this check leaves out the rules for Alpha. What’s listed below is still right.',
    );
    expect(
      missingLayerNote([layers[0], { ...layers[1], status: 'ready' }]),
    ).toBeNull();
    const both = layers.map((l) => ({ ...l, status: 'missing' as const }));
    expect(missingLayerNote(both)).toContain(
      'the shared rules and the rules for Alpha',
    );
  });
});
