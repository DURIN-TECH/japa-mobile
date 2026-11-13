// Save / debounce / error behaviour of an information answer (issue #187).

// useAnswers imports the api service (native Firebase): mock it, no network.
jest.mock('@/services/api.service', () => ({
  apiService: { get: jest.fn(), put: jest.fn() },
}));
import {
  describe,
  expect,
  it,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import {
  createAnswerSaver,
  SAVE_DEBOUNCE_MS,
  type SaverStatus,
} from '../answerSaver';
import { classifySaveError } from '@/hooks/useAnswers';

type Save = (t: string) => Promise<void>;

function setup(saved = '', save: Save = async () => {}) {
  const sent: string[] = [];
  const statuses: SaverStatus['phase'][] = [];
  const cleared: string[] = [];
  const saveFn = jest.fn<Save>(async (t) => {
    sent.push(t);
    await save(t);
  });
  const saver = createAnswerSaver({
    saved,
    save: saveFn,
    onStatus: (s) => statuses.push(s.phase),
    onSaved: (trimmed, latest) => {
      if (latest.trim() === trimmed) cleared.push(trimmed);
    },
  });
  return { saver, sent, statuses, cleared, saveFn };
}

// Let queued promise callbacks run.
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('debounce', () => {
  it('saves 1.5 s after the last keystroke, trimmed', async () => {
    const { saver, sent } = setup();
    saver.change('ab');
    jest.advanceTimersByTime(SAVE_DEBOUNCE_MS - 1);
    saver.change('abc  ');
    jest.advanceTimersByTime(SAVE_DEBOUNCE_MS - 1);
    expect(sent).toEqual([]); // each keystroke restarted the clock
    jest.advanceTimersByTime(1);
    await settle();
    expect(sent).toEqual(['abc']);
  });

  it('saves right away on flush (blur)', async () => {
    const { saver, sent } = setup();
    saver.change('hello');
    saver.flush();
    await settle();
    expect(sent).toEqual(['hello']);
  });

  it('does not send when the text equals the saved text', async () => {
    const { saver, saveFn } = setup('same');
    saver.change('  same ');
    saver.flush();
    await settle();
    expect(saveFn).not.toHaveBeenCalled();
  });

  it('an emptied field saves "" (clears the answer)', async () => {
    const { saver, sent } = setup('old');
    saver.change('');
    saver.flush();
    await settle();
    expect(sent).toEqual(['']);
  });

  it('goes saving -> saved, and clears the draft on success', async () => {
    const { saver, statuses, cleared } = setup();
    saver.change('x');
    saver.flush();
    await settle();
    expect(statuses).toEqual(['saving', 'saved']);
    expect(cleared).toEqual(['x']);
  });
});

describe('one save in flight', () => {
  it('typing during a save sends the newest text right after', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let first = true;
    const { saver, sent } = setup('', async () => {
      if (first) {
        first = false;
        await gate;
      }
    });
    saver.change('one');
    saver.flush();
    await settle();
    saver.change('one two');
    saver.flush(); // blur while the first is still in flight: must not overlap
    await settle();
    expect(sent).toEqual(['one']);
    release();
    await settle();
    expect(sent).toEqual(['one', 'one two']);
  });
});

describe('failure keeps the text', () => {
  it('reports the error, keeps the text, and a retry sends it again', async () => {
    let fail = true;
    const { saver, sent, statuses, cleared } = setup('', async () => {
      if (fail) throw { code: 'NETWORK_ERROR', status: 0 };
    });
    saver.change('my dates');
    saver.flush();
    await settle();
    expect(statuses).toEqual(['saving', 'error']);
    expect(cleared).toEqual([]); // draft NOT cleared on failure
    fail = false;
    saver.flush(); // "Try again"
    await settle();
    expect(sent).toEqual(['my dates', 'my dates']);
    expect(statuses.at(-1)).toBe('saved');
    expect(cleared).toEqual(['my dates']);
  });

  it('a server refetch never replaces unsaved text', async () => {
    const { saver, sent } = setup('', async () => {
      throw { status: 500 };
    });
    saver.change('draft');
    saver.flush();
    await settle();
    saver.setSaved('older server text'); // must be ignored: the draft is newer
    saver.flush();
    await settle();
    expect(sent).toEqual(['draft', 'draft']);
  });
});

describe('classifySaveError', () => {
  it('maps each failure to its copy variant', () => {
    expect(classifySaveError({ code: 'NETWORK_ERROR', status: 0 }, 'a')).toBe(
      'offline',
    );
    expect(
      classifySaveError({ status: 402, code: 'UPGRADE_REQUIRED' }, 'a'),
    ).toBe('read_only_plan');
    expect(classifySaveError({ status: 403 }, 'a')).toBe('other');
    expect(
      classifySaveError({ status: 400, code: 'VALIDATION_ERROR' }, 'a'),
    ).toBe('list_changed');
    expect(classifySaveError({ status: 400 }, 'a'.repeat(2001))).toBe(
      'too_long',
    );
    expect(
      classifySaveError({ status: 409, code: 'ANSWERS_LOCKED' }, 'a'),
    ).toBe('locked');
    expect(classifySaveError({ status: 500 }, 'a')).toBe('other');
  });
});
