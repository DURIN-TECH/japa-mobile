// The field hook of one information item (#187) with typed values: drafts come
// back and save, invalid input is blocked before the PUT and kept, an unreadable
// draft is never sent as empty, and one saver survives a remount.

jest.mock('expo-router', () => {
  const R = require('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) =>
      R.useEffect(() => cb(), [cb]),
  };
});
jest.mock('expo-secure-store', () => ({}));
jest.mock('@/services/api.service', () => ({
  apiService: { get: jest.fn(), put: jest.fn() },
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { useAnswerField } from '@/components/explorer/InformationAnswer';
import { dropAllSavers } from '@/components/explorer/answerSavers';
import { useAnswerDraftsStore } from '@/stores/answerDrafts.store';
import { encodeForm } from '@/components/explorer/answerTypes';
import { SAVE_DEBOUNCE_MS } from '@/components/explorer/answerSaver';

type Field = ReturnType<typeof useAnswerField>;
type SaveFn = (v: unknown) => Promise<unknown>;

const renderers: ReturnType<typeof create>[] = [];
function mount(
  type: Parameters<typeof useAnswerField>[0]['type'],
  save: SaveFn,
  savedValue?: unknown,
) {
  const ref: { current: Field | null } = { current: null };
  function Probe() {
    ref.current = useAnswerField({
      applicationId: 'a1',
      itemId: 'i1',
      type,
      currency: 'GBP',
      savedValue,
      save,
      onLocked: () => {},
      locked: false,
    });
    return null;
  }
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  let r!: ReturnType<typeof create>;
  act(() => {
    r = create(<Probe />);
  });
  renderers.push(r);
  return { ref, unmount: () => act(() => r.unmount()) };
}
const tick = async (ms = SAVE_DEBOUNCE_MS + 50) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};
const setDraft = (wire: string) =>
  act(() => useAnswerDraftsStore.getState().setDraft('a1', 'i1', wire));

beforeEach(() => {
  jest.useFakeTimers();
  dropAllSavers();
  useAnswerDraftsStore.setState({ drafts: {}, uid: null });
});
afterEach(() => {
  act(() => renderers.splice(0).forEach((r) => r.unmount()));
  jest.useRealTimers();
});

describe('draft restore of typed values', () => {
  it('a structured draft shows in the input and saves once as a typed value', async () => {
    const save = jest.fn<SaveFn>().mockResolvedValue({});
    setDraft(encodeForm('list', ['one', 'two']));
    const h = mount('list', save);
    expect(h.ref.current!.form).toEqual(['one', 'two']);
    await tick();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(['one', 'two']);
  });

  it('a date range draft comes back as both dates', async () => {
    const save = jest.fn<SaveFn>().mockResolvedValue({});
    setDraft(
      encodeForm('date_range', { from: '2027-03-01', to: '2027-03-10' }),
    );
    const h = mount('date_range', save);
    expect(h.ref.current!.form).toEqual({
      from: '2027-03-01',
      to: '2027-03-10',
    });
    await tick();
    expect(save).toHaveBeenCalledWith({ from: '2027-03-01', to: '2027-03-10' });
  });

  it('a plain-text draft on a list item is one entry, never an empty list', async () => {
    const save = jest.fn<SaveFn>().mockResolvedValue({});
    setDraft('I went to France in 2019');
    mount('list', save);
    await tick();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(['I went to France in 2019']);
    for (const call of save.mock.calls) {
      expect(call[0]).not.toEqual([]);
      expect(call[0]).not.toBeNull();
    }
  });
});

describe('invalid input is blocked before the PUT', () => {
  it('an end date before the start sends nothing and keeps the draft', async () => {
    const save = jest.fn<SaveFn>().mockResolvedValue({});
    const h = mount('date_range', save);
    act(() =>
      h.ref.current!.onChangeForm({ from: '2027-03-10', to: '2027-03-01' }),
    );
    await tick();
    expect(save).not.toHaveBeenCalled();
    const s = h.ref.current!.status;
    expect(s.phase).toBe('error');
    expect((s as { error: { field: string } }).error.field).toBe('to');
    // what they typed is kept, in the field and in the draft store
    expect(h.ref.current!.form).toEqual({
      from: '2027-03-10',
      to: '2027-03-01',
    });
    expect(useAnswerDraftsStore.getState().drafts['a1:i1']).toContain(
      '2027-03-10',
    );
  });

  it('an unreadable draft is shown and kept, and nothing is sent', async () => {
    const save = jest.fn<SaveFn>().mockResolvedValue({});
    setDraft('some old text');
    const h = mount('date_range', save);
    await tick();
    expect(save).not.toHaveBeenCalled();
    expect(h.ref.current!.unreadableDraft).toBe('some old text');
    expect(useAnswerDraftsStore.getState().drafts['a1:i1']).toBe(
      'some old text',
    );
  });

  it('emptying a typed input clears with null', async () => {
    const save = jest.fn<SaveFn>().mockResolvedValue({});
    const h = mount('address', save, {
      line1: '1 High St',
      city: 'Leeds',
      country: 'UK',
    });
    act(() =>
      h.ref.current!.onChangeForm({
        line1: '',
        line2: '',
        city: '',
        region: '',
        postcode: '',
        country: '',
        note: '',
      }),
    );
    await tick();
    expect(save).toHaveBeenCalledWith(null);
  });
});

describe('one saver across a remount', () => {
  it('a remount mid-save never starts a second PUT; the newest value goes next', async () => {
    let release!: () => void;
    const save = jest
      .fn<SaveFn>()
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            release = () => res({});
          }),
      )
      .mockResolvedValue({});
    const first = mount('list', save);
    act(() => first.ref.current!.onChangeForm(['x']));
    await tick();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith(['x']);

    // leave the screen and come back while the save is in flight
    first.unmount();
    const second = mount('list', save);
    act(() => second.ref.current!.onChangeForm(['x', 'y']));
    await tick();
    expect(save).toHaveBeenCalledTimes(1); // still only the one in flight

    await act(async () => {
      release();
    });
    await tick();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(['x', 'y']);
  });
});
