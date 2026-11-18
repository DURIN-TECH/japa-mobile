// ─────────────────────────────────────────────────────────────────────────────
// savedLogic (japa#146): save identity, list cleaning, optimistic edits and
// their inverses, the heart's state + labels, failure copy, Profile count.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import {
  HEART_LABEL,
  heartState,
  isSavedIn,
  normaliseSavedList,
  optimisticItem,
  saveErrorCopy,
  savedCountLabel,
  savedKey,
  savedVisaAsVisaType,
  withRestored,
  withSaved,
  withServerItem,
  withoutSaved,
} from '../savedLogic';
import { visaTypeToDest } from '../liveExplore';
import type { SavedDestinationItem } from '@/types/savedDestinations.type';

/** A saved item as the API sends it. */
function item(
  code: string,
  visaId: string,
  seconds = 100,
): SavedDestinationItem {
  return {
    countryCode: code,
    visaId,
    savedAt: { _seconds: seconds, _nanoseconds: 0 },
    countryName: 'United Kingdom',
    visa: {
      id: visaId,
      countryCode: code,
      name: `Visa ${visaId}`,
      description: 'A visa',
      category: 'work',
      processingTime: '3 weeks',
      baseCostUsd: 719,
      successRate: 82,
      totalApplications: 10,
      source: null,
    },
  };
}

describe('identity', () => {
  it('country code matches in any case', () => {
    expect(savedKey('gb', 'skilled')).toBe(savedKey('GB', 'skilled'));
    expect(isSavedIn([item('GB', 'skilled')], 'gb', 'skilled')).toBe(true);
    expect(isSavedIn([item('GB', 'skilled')], 'gb', 'student')).toBe(false);
  });
});

describe('normaliseSavedList', () => {
  it('drops malformed items and fills missing visa text', () => {
    const raw = [
      item('gb', 'a'),
      { countryCode: 'GB' }, // no visa id / visa
      null,
      {
        ...item('CA', 'b'),
        visa: { ...item('CA', 'b').visa, description: undefined },
      },
    ];
    const out = normaliseSavedList(raw);
    expect(out.map((i) => i.visaId)).toEqual(['a', 'b']);
    expect(out[0].countryCode).toBe('GB');
    expect(out[1].visa.description).toBe('');
  });

  it('a missing processingTime never renders "undefined" on a tile', () => {
    const raw = item('GB', 'a');
    delete raw.visa.processingTime;
    const [clean] = normaliseSavedList([raw]);
    const d = visaTypeToDest(
      savedVisaAsVisaType(clean.visa),
      clean.countryName,
    );
    expect(d.processing).toBe('');
    expect(d.flag).toBe('gb');
    expect(d.country).toBe('United Kingdom');
  });

  it('not an array → empty', () => {
    expect(normaliseSavedList(undefined)).toEqual([]);
  });
});

describe('optimistic edits', () => {
  const a = item('GB', 'a');
  const b = item('CA', 'b');
  const c = item('US', 'c');

  it('save puts the item first and never twice', () => {
    expect(withSaved([a, b], c).map((i) => i.visaId)).toEqual(['c', 'a', 'b']);
    expect(withSaved([a, b], b).map((i) => i.visaId)).toEqual(['b', 'a']);
  });

  it('remove, then restore puts it back where it was', () => {
    const without = withoutSaved([a, b, c], 'ca', 'b');
    expect(without.map((i) => i.visaId)).toEqual(['a', 'c']);
    expect(withRestored(without, b, 1).map((i) => i.visaId)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('the server item replaces the optimistic one in place', () => {
    const fresh = { ...b, savedAt: { _seconds: 999, _nanoseconds: 0 } };
    const out = withServerItem([a, b, c], fresh);
    expect(out.map((i) => i.visaId)).toEqual(['a', 'b', 'c']);
    expect(out[1].savedAt._seconds).toBe(999);
  });

  it('optimisticItem is upper case and dated now', () => {
    const o = optimisticItem(
      'gb',
      'x',
      { name: 'Skilled Worker', category: 'work' },
      undefined,
      5000,
    );
    expect(o.countryCode).toBe('GB');
    expect(o.countryName).toBe('GB');
    expect(o.savedAt._seconds).toBe(5);
    expect(o.visa.processingTime).toBe('');
  });
});

describe('heartState', () => {
  const base = {
    countryCode: 'gb',
    visaId: 'a',
    isFetching: false,
    isError: false,
  };
  it('saved / not saved from the cached list (even mid-refetch)', () => {
    expect(heartState({ ...base, list: [item('GB', 'a')] })).toBe('saved');
    expect(heartState({ ...base, list: [], isFetching: true })).toBe(
      'notSaved',
    );
  });
  it('no list: spinner while fetching, dimmed once failed', () => {
    expect(heartState({ ...base, list: undefined, isFetching: true })).toBe(
      'loading',
    );
    expect(heartState({ ...base, list: undefined, isError: true })).toBe(
      'error',
    );
    // Retrying after a failure shows the spinner again.
    expect(
      heartState({
        ...base,
        list: undefined,
        isError: true,
        isFetching: true,
      }),
    ).toBe('loading');
  });
  it('labels say what a tap does', () => {
    expect(HEART_LABEL.notSaved).toBe('Save destination');
    expect(HEART_LABEL.saved).toBe('Remove from saved');
  });
});

describe('saveErrorCopy (status / code only)', () => {
  it('read-only plan, per action', () => {
    expect(saveErrorCopy({ status: 402 }, 'save')).toBe(
      'Your plan is read-only. Renew your subscription to save destinations.',
    );
    expect(saveErrorCopy({ status: 402 }, 'remove')).toBe(
      'Your plan is read-only. Renew your subscription to change your saved list.',
    );
  });
  it('cap, unavailable, generic, 401', () => {
    expect(
      saveErrorCopy({ status: 409, code: 'SAVED_LIMIT_REACHED' }, 'save'),
    ).toContain('saved 200 destinations');
    expect(saveErrorCopy({ status: 404 }, 'save')).toBe(
      'This destination isn’t available to save right now.',
    );
    expect(saveErrorCopy({ code: 'NETWORK_ERROR', status: 0 }, 'save')).toBe(
      'We couldn’t save this destination. Check your connection and try again.',
    );
    expect(saveErrorCopy({ status: 500 }, 'remove')).toBe(
      'We couldn’t remove this from saved. Check your connection and try again.',
    );
    expect(saveErrorCopy({ status: 401 }, 'save')).toBeNull();
  });
});

describe('savedCountLabel', () => {
  it('the list length, or "–" when unknown', () => {
    expect(savedCountLabel([item('GB', 'a'), item('CA', 'b')])).toBe('2');
    expect(savedCountLabel([])).toBe('0');
    expect(savedCountLabel(undefined)).toBe('–');
  });
});
