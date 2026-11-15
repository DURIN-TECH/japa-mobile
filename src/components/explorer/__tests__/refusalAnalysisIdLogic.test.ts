// #269: which refusal analysis the refusal-letter screen shows when a push
// carries an analysisId (adopt it, fall back when it is rejected).
import { describe, expect, it } from '@jest/globals';
import {
  type AnalysisIdState,
  currentAnalysisId,
  isAnalysisGone,
  nextAnalysisIdStep,
} from '../refusalAnalysisIdLogic';

const base: AnalysisIdState = {
  paramId: null,
  savedId: null,
  storedReady: true,
  paramHandled: false,
  pushedId: null,
  previousId: null,
  loadError: null,
};
const s = (over: Partial<AnalysisIdState>): AnalysisIdState => ({
  ...base,
  ...over,
});

describe('currentAnalysisId', () => {
  it('a pending param wins over the saved id', () => {
    expect(currentAnalysisId(s({ paramId: 'p', savedId: 'old' }))).toBe('p');
  });
  it('no param → the saved id (or none)', () => {
    expect(currentAnalysisId(s({ savedId: 'old' }))).toBe('old');
    expect(currentAnalysisId(s({}))).toBeNull();
  });
  it('after adoption the saved id is the one current id', () => {
    expect(
      currentAnalysisId(s({ paramId: 'p', paramHandled: true, savedId: 'p' })),
    ).toBe('p');
  });
});

describe('nextAnalysisIdStep', () => {
  it('waits for storage before doing anything', () => {
    expect(nextAnalysisIdStep(s({ paramId: 'p', storedReady: false }))).toEqual(
      { kind: 'none' },
    );
  });
  it('param present, nothing saved → adopt, no fallback', () => {
    expect(nextAnalysisIdStep(s({ paramId: 'p' }))).toEqual({
      kind: 'adopt',
      id: 'p',
      previousId: null,
    });
  });
  it('param present, another id saved → adopt, keep the saved one as fallback', () => {
    expect(nextAnalysisIdStep(s({ paramId: 'p', savedId: 'old' }))).toEqual({
      kind: 'adopt',
      id: 'p',
      previousId: 'old',
    });
  });
  it('param equals the saved id → adopt with no separate fallback', () => {
    expect(nextAnalysisIdStep(s({ paramId: 'p', savedId: 'p' }))).toEqual({
      kind: 'adopt',
      id: 'p',
      previousId: null,
    });
  });
  it('no param → nothing to do, with or without a saved id', () => {
    expect(nextAnalysisIdStep(s({}))).toEqual({ kind: 'none' });
    expect(nextAnalysisIdStep(s({ savedId: 'old' }))).toEqual({ kind: 'none' });
  });
  it('never adopts the same param twice', () => {
    expect(
      nextAnalysisIdStep(s({ paramId: 'p', paramHandled: true, savedId: 'p' })),
    ).toEqual({ kind: 'none' });
  });

  const adopted = {
    paramId: 'p',
    paramHandled: true,
    savedId: 'p',
    pushedId: 'p',
  };
  it('pushed id rejected (404) → back to the previously saved id', () => {
    expect(
      nextAnalysisIdStep(
        s({ ...adopted, previousId: 'old', loadError: { status: 404 } }),
      ),
    ).toEqual({ kind: 'fallback', id: 'old' });
  });
  it('pushed id rejected (403), nothing saved before → upload step', () => {
    expect(
      nextAnalysisIdStep(s({ ...adopted, loadError: { status: 403 } })),
    ).toEqual({ kind: 'fallback', id: null });
  });
  it('a network / server failure keeps the normal error + retry', () => {
    expect(
      nextAnalysisIdStep(s({ ...adopted, loadError: { status: 0 } })),
    ).toEqual({ kind: 'none' });
    expect(
      nextAnalysisIdStep(s({ ...adopted, loadError: { status: 500 } })),
    ).toEqual({ kind: 'none' });
  });
  it('a 404 on a saved (not pushed) id is not handled here', () => {
    expect(
      nextAnalysisIdStep(s({ savedId: 'old', loadError: { status: 404 } })),
    ).toEqual({ kind: 'none' });
  });
  it('start over: saved and pushed ids cleared → upload step, nothing re-adopted', () => {
    const after = s({ paramId: 'p', paramHandled: true });
    expect(currentAnalysisId(after)).toBeNull();
    expect(nextAnalysisIdStep(after)).toEqual({ kind: 'none' });
  });
  it('a new analysis after adoption is never treated as the pushed one', () => {
    expect(
      nextAnalysisIdStep(
        s({ ...adopted, savedId: 'new', loadError: { status: 404 } }),
      ),
    ).toEqual({ kind: 'none' });
  });
});

describe('isAnalysisGone', () => {
  it('only 403 and 404', () => {
    expect(isAnalysisGone({ status: 403 })).toBe(true);
    expect(isAnalysisGone({ status: 404 })).toBe(true);
    expect(isAnalysisGone({ status: 402 })).toBe(false);
    expect(isAnalysisGone(null)).toBe(false);
    expect(isAnalysisGone(new Error('x'))).toBe(false);
  });
});
