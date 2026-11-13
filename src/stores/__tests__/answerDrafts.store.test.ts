import { describe, expect, it, beforeEach } from '@jest/globals';
import { useAnswerDraftsStore, draftKey } from '../answerDrafts.store';

beforeEach(() => useAnswerDraftsStore.getState().clearAll());

describe('answer drafts', () => {
  it('keys by application and item, clears one, clears all', () => {
    const s = useAnswerDraftsStore.getState();
    s.setDraft('app1', 'i1', 'a');
    s.setDraft('app2', 'i1', 'b');
    expect(useAnswerDraftsStore.getState().drafts[draftKey('app1', 'i1')]).toBe(
      'a',
    );
    s.clearDraft('app1', 'i1');
    expect(Object.keys(useAnswerDraftsStore.getState().drafts)).toEqual([
      'app2:i1',
    ]);
    s.clearAll();
    expect(useAnswerDraftsStore.getState().drafts).toEqual({});
  });
});
