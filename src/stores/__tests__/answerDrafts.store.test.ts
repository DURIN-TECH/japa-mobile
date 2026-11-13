// In-memory drafts store with debounced write-through to the encrypted vault
// (issue #187). The vault is replaced by a spy implementation.
jest.mock('expo-secure-store', () => ({}));

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  useAnswerDraftsStore,
  draftKey,
  setDraftVault,
  VAULT_WRITE_DEBOUNCE_MS,
} from '../answerDrafts.store';
import type { DraftVault, StoredDraft } from '@/services/draftVault';

const save = jest.fn<DraftVault['save']>(async () => {});
const del = jest.fn<DraftVault['delete']>(async () => {});
const clearAll = jest.fn<DraftVault['clearAll']>(async () => {});
const load = jest.fn<DraftVault['load']>(async () => []);

beforeEach(() => {
  jest.useFakeTimers();
  setDraftVault({ save, delete: del, clearAll, load });
  useAnswerDraftsStore.getState().clearAll();
  jest.clearAllMocks();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('answer drafts', () => {
  it('keys by application and item', () => {
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
  });

  it('writes through to the vault once, debounced', () => {
    const s = useAnswerDraftsStore.getState();
    s.setDraft('app1', 'i1', 'a');
    s.setDraft('app1', 'i1', 'ab');
    expect(save).not.toHaveBeenCalled();
    jest.advanceTimersByTime(VAULT_WRITE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('app1', 'i1', 'ab');
  });

  it('clear-on-save: deletes the stored draft and cancels a pending write', () => {
    const s = useAnswerDraftsStore.getState();
    s.setDraft('app1', 'i1', 'a');
    s.clearDraft('app1', 'i1');
    jest.advanceTimersByTime(VAULT_WRITE_DEBOUNCE_MS * 2);
    expect(del).toHaveBeenCalledWith('app1', 'i1');
    expect(save).not.toHaveBeenCalled();
  });

  it('clear-on-sign-out: clearAll empties memory and the vault', () => {
    const s = useAnswerDraftsStore.getState();
    s.setDraft('app1', 'i1', 'a');
    s.clearAll();
    jest.advanceTimersByTime(VAULT_WRITE_DEBOUNCE_MS * 2);
    expect(useAnswerDraftsStore.getState().drafts).toEqual({});
    expect(clearAll).toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('loadFromVault fills missing drafts but never overwrites typed text', async () => {
    const stored: StoredDraft[] = [
      { applicationId: 'app1', itemId: 'i1', text: 'stored', updatedAt: 1 },
      { applicationId: 'app1', itemId: 'i2', text: 'stored2', updatedAt: 1 },
    ];
    load.mockResolvedValueOnce(stored);
    useAnswerDraftsStore.getState().setDraft('app1', 'i1', 'typed');
    await useAnswerDraftsStore.getState().loadFromVault();
    const d = useAnswerDraftsStore.getState().drafts;
    expect(d[draftKey('app1', 'i1')]).toBe('typed');
    expect(d[draftKey('app1', 'i2')]).toBe('stored2');
  });
});
