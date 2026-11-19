// Drafts store with debounced write-through to the encrypted vault (issue #187).
// The vault is replaced by a spy implementation.
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
import { acquireSaver, hasSaver } from '@/components/explorer/answerSavers';
import type { DraftVault, StoredDraft } from '@/services/draftVault';

const save = jest.fn<DraftVault['save']>(async () => {});
const del = jest.fn<DraftVault['delete']>(async () => {});
const clearAll = jest.fn<DraftVault['clearAll']>(async () => {});
const load = jest.fn<DraftVault['load']>(async () => []);
const U = 'uid-1';
const st = () => useAnswerDraftsStore.getState();

beforeEach(() => {
  jest.useFakeTimers();
  setDraftVault({ save, delete: del, clearAll, load });
  st().clearAll();
  jest.clearAllMocks();
  // A signed-in user whose (empty) drafts are loaded.
  return st().loadFromVault(U);
});
afterEach(() => {
  jest.useRealTimers();
});

describe('answer drafts', () => {
  it('keys by application and item', () => {
    st().setDraft('app1', 'i1', 'a');
    st().setDraft('app2', 'i1', 'b');
    expect(st().drafts[draftKey('app1', 'i1')]).toBe('a');
    st().clearDraft('app1', 'i1');
    expect(Object.keys(st().drafts)).toEqual(['app2:i1']);
  });

  it('writes through to the vault once, debounced, for the current uid', () => {
    st().setDraft('app1', 'i1', 'a');
    st().setDraft('app1', 'i1', 'ab');
    expect(save).not.toHaveBeenCalled();
    jest.advanceTimersByTime(VAULT_WRITE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(U, 'app1', 'i1', 'ab');
  });

  it('flushWrites writes pending drafts at once (app to background, blur)', () => {
    st().setDraft('app1', 'i1', 'typed fast');
    st().flushWrites();
    expect(save).toHaveBeenCalledWith(U, 'app1', 'i1', 'typed fast');
    jest.advanceTimersByTime(VAULT_WRITE_DEBOUNCE_MS * 2);
    expect(save).toHaveBeenCalledTimes(1); // not written again by the timer
  });

  it('clear-on-save: deletes the stored draft and cancels a pending write', () => {
    st().setDraft('app1', 'i1', 'a');
    st().clearDraft('app1', 'i1');
    jest.advanceTimersByTime(VAULT_WRITE_DEBOUNCE_MS * 2);
    expect(del).toHaveBeenCalledWith(U, 'app1', 'i1');
    expect(save).not.toHaveBeenCalled();
  });

  it('clear-on-sign-out: clearAll empties memory, the vault and the savers', () => {
    st().setDraft('app1', 'i1', 'a');
    acquireSaver(draftKey('app1', 'i1'), '');
    st().clearAll();
    jest.advanceTimersByTime(VAULT_WRITE_DEBOUNCE_MS * 2);
    expect(st().drafts).toEqual({});
    expect(st().uid).toBeNull();
    expect(clearAll).toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(hasSaver(draftKey('app1', 'i1'))).toBe(false);
  });
});

describe('loading', () => {
  it('fills missing drafts but never overwrites typed text', async () => {
    const stored: StoredDraft[] = [
      { applicationId: 'app1', itemId: 'i1', text: 'stored', updatedAt: 1 },
      { applicationId: 'app1', itemId: 'i2', text: 'stored2', updatedAt: 1 },
    ];
    load.mockResolvedValueOnce(stored);
    st().setDraft('app1', 'i1', 'typed');
    await st().loadFromVault(U);
    expect(st().drafts[draftKey('app1', 'i1')]).toBe('typed');
    expect(st().drafts[draftKey('app1', 'i2')]).toBe('stored2');
    expect(load).toHaveBeenCalledWith(U);
  });

  it('a load that began before a sign-out cannot repopulate memory', async () => {
    let release!: (d: StoredDraft[]) => void;
    load.mockImplementationOnce(() => new Promise((r) => (release = r)));
    const pending = st().loadFromVault(U);
    st().clearAll(); // sign-out while the vault is being read
    release([
      {
        applicationId: 'app1',
        itemId: 'i1',
        text: 'old session',
        updatedAt: 1,
      },
    ]);
    await pending;
    expect(st().drafts).toEqual({});
  });

  it('a different uid replaces the drafts in memory', async () => {
    st().setDraft('app1', 'i1', 'first user');
    await st().loadFromVault('uid-2');
    expect(st().drafts).toEqual({});
    expect(st().uid).toBe('uid-2');
    expect(load).toHaveBeenLastCalledWith('uid-2');
  });
});

describe('locked application / item no longer listed', () => {
  it('pruneDrafts drops drafts of unlisted items (memory, vault, saver) and keeps the rest', () => {
    st().setDraft('app1', 'keep', 'k');
    st().setDraft('app1', 'gone', 'g');
    st().setDraft('app2', 'other-app', 'o');
    acquireSaver(draftKey('app1', 'gone'), '');
    st().pruneDrafts('app1', ['keep']);
    expect(Object.keys(st().drafts).sort()).toEqual([
      'app1:keep',
      'app2:other-app',
    ]);
    expect(del).toHaveBeenCalledWith(U, 'app1', 'gone');
    expect(hasSaver(draftKey('app1', 'gone'))).toBe(false);
  });

  it('an empty list (locked application) drops all of that application’s drafts', () => {
    st().setDraft('app1', 'a', '1');
    st().setDraft('app1', 'b', '2');
    st().pruneDrafts('app1', []);
    expect(st().drafts).toEqual({});
  });
});

describe('one saver per item', () => {
  it('every mount of the same item gets the same saver and status', () => {
    const a = acquireSaver('app1:i1', 'x');
    const b = acquireSaver('app1:i1', 'x');
    expect(b).toBe(a);
    expect(acquireSaver('app1:i2', '')).not.toBe(a);
  });
});
