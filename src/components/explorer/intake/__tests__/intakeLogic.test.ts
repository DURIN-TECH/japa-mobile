// ─────────────────────────────────────────────────────────────────────────────
// Intake show-when logic (issue #113). Mirrors the server's rule: questions
// are evaluated in order and a HIDDEN question's answer does not count for
// later conditions.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import { visibleIds, openRequired, payloadAnswers } from '../intakeLogic';

const q = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    label: id,
    answerType: 'single_choice',
    required: true,
    ...extra,
  }) as never;

describe('visibleIds', () => {
  const questions = [
    q('a'),
    q('b', {
      showWhen: { anyOf: [{ questionId: 'a', op: 'eq', value: 'yes' }] },
    }),
    // c depends on b: when b is hidden its stale answer must not show c.
    q('c', {
      showWhen: { anyOf: [{ questionId: 'b', op: 'eq', value: 'x' }] },
    }),
  ];

  it('shows a conditional question only when its condition holds', () => {
    expect([...visibleIds(questions, { a: 'no' })]).toEqual(['a']);
    expect([...visibleIds(questions, { a: 'yes' })]).toEqual(['a', 'b']);
  });

  it('ignores the answer of a hidden question for later conditions', () => {
    const v = visibleIds(questions, { a: 'no', b: 'x' });
    expect(v.has('c')).toBe(false);
    expect(visibleIds(questions, { a: 'yes', b: 'x' }).has('c')).toBe(true);
  });

  it('supports neq (needs an answer) and in; unknown ops never show', () => {
    const qs = [
      q('a'),
      q('n', {
        showWhen: { anyOf: [{ questionId: 'a', op: 'neq', value: 'x' }] },
      }),
      q('i', {
        showWhen: { anyOf: [{ questionId: 'a', op: 'in', value: ['p', 'q'] }] },
      }),
      q('z', {
        showWhen: { anyOf: [{ questionId: 'a', op: 'weird', value: 'p' }] },
      }),
    ];
    expect(visibleIds(qs, {}).has('n')).toBe(false); // neq needs an answer
    expect(visibleIds(qs, { a: 'y' }).has('n')).toBe(true);
    expect(visibleIds(qs, { a: 'p' }).has('i')).toBe(true);
    expect(visibleIds(qs, { a: 'r' }).has('i')).toBe(false);
    expect(visibleIds(qs, { a: 'p' }).has('z')).toBe(false);
  });
});

describe('openRequired / payloadAnswers', () => {
  const questions = [
    q('a'),
    q('b', {
      showWhen: { anyOf: [{ questionId: 'a', op: 'eq', value: 'yes' }] },
    }),
  ];
  it('counts only visible required blanks', () => {
    expect(openRequired(questions, { a: 'no' }).map((x) => x.id)).toEqual([]);
    expect(openRequired(questions, { a: 'yes' }).map((x) => x.id)).toEqual([
      'b',
    ]);
  });
  it("never sends a hidden question's answer", () => {
    expect(payloadAnswers(questions, { a: 'no', b: 'stale' })).toEqual({
      a: 'no',
    });
  });
});
