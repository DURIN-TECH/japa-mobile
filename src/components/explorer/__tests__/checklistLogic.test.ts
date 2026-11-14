// Need labels, kind fallback and progress counting (issue #187).
import { describe, expect, it } from '@jest/globals';
import {
  appliesWhenText,
  computeProgress,
  isInformationItem,
  itemState,
  needLabel,
  needOf,
} from '../checklistLogic';
import type { Checklist, ChecklistItem } from '@/types/checklist.type';
import type { Document } from '@/types/documents.type';

// A minimal item; each test overrides what it cares about.
const item = (over: Partial<ChecklistItem> = {}): ChecklistItem => ({
  checklistItemId: 'i1',
  title: 'a thing',
  holder: 'applicant',
  required: true,
  reason: '',
  citation: { quote: 'q', url: 'https://example.gov' },
  documentRequestId: 'r1',
  status: 'pending',
  current: true,
  ...over,
});
const doc = (requestId: string, status: string) =>
  ({
    id: 'd' + requestId,
    requirementId: `docreq:${requestId}`,
    status,
  }) as unknown as Document;
const list = (items: ChecklistItem[]): Checklist => ({
  state: 'ready',
  rubricVersion: 1,
  items,
});

describe('need labels', () => {
  it('maps the three needs', () => {
    expect(needLabel('required')).toBe('Required');
    expect(needLabel('conditional')).toBe('If it applies to you');
    expect(needLabel('optional')).toBe('Optional');
  });

  it('falls back to required / optional when an older response has no need', () => {
    expect(needOf(item({ need: undefined, required: true }))).toBe('required');
    expect(needOf(item({ need: undefined, required: false }))).toBe('optional');
    expect(needOf(item({ need: 'conditional', required: false }))).toBe(
      'conditional',
    );
  });

  it('shows the appliesWhen clause only for conditional items, verbatim', () => {
    const c = item({
      need: 'conditional',
      required: false,
      appliesWhen: 'if you’re visiting for more than 6 months',
    });
    expect(appliesWhenText(c)).toBe(
      'if you’re visiting for more than 6 months',
    );
    expect(
      appliesWhenText(item({ need: 'required', appliesWhen: 'if x' })),
    ).toBe(null);
    expect(appliesWhenText(item({ need: 'conditional' }))).toBe(null);
  });

  it('drops a single trailing colon from the lead-in', () => {
    const lead =
      'Depending on your circumstances, you might also need to provide:';
    expect(
      appliesWhenText(item({ need: 'conditional', appliesWhen: lead })),
    ).toBe(lead.slice(0, -1));
  });
});

describe('kind', () => {
  it('a missing kind is a document', () => {
    expect(isInformationItem(item())).toBe(false);
  });
  it('an information item is information', () => {
    expect(isInformationItem(item({ kind: 'information' }))).toBe(true);
  });
  it('a kindReview item renders as a document, with a normal need label', () => {
    const r = item({
      kind: 'document',
      kindReview: true,
      need: 'optional',
      required: false,
    });
    expect(isInformationItem(r)).toBe(false);
    expect(needLabel(needOf(r))).toBe('Optional');
    // Even a contradictory `kind` cannot make it information.
    expect(isInformationItem({ ...r, kind: 'information' })).toBe(false);
    expect(itemState(r, [], {})).toBe('waiting');
  });
});

describe('item state', () => {
  it('information: Answered only with a non-empty saved answer', () => {
    const i = item({ kind: 'information', documentRequestId: null });
    expect(itemState(i, [], {})).toBe('waiting');
    expect(itemState(i, [], { i1: { value: '  ', updatedAt: 'x' } })).toBe(
      'waiting',
    );
    expect(itemState(i, [], { i1: { value: 'hi', updatedAt: 'x' } })).toBe(
      'answered',
    );
  });
  it('waived is not needed', () => {
    expect(itemState(item({ status: 'waived' }), [], {})).toBe('not_needed');
  });
});

describe('progress counting', () => {
  const items = [
    item({ checklistItemId: 'a', documentRequestId: 'ra', need: 'required' }), // document, required
    item({
      checklistItemId: 'b',
      documentRequestId: 'rb',
      need: 'conditional',
      required: false,
    }),
    item({
      checklistItemId: 'c',
      kind: 'information',
      documentRequestId: null,
      need: 'required',
    }),
    item({
      checklistItemId: 'd',
      kind: 'information',
      documentRequestId: null,
      need: 'conditional',
      required: false,
    }),
    item({
      checklistItemId: 'e',
      kind: 'information',
      documentRequestId: null,
      need: 'optional',
      required: false,
    }),
  ];

  it('counts both kinds, but the bar uses required items only', () => {
    const docs = [doc('ra', 'verified'), doc('rb', 'uploaded')];
    const p = computeProgress(list(items), docs, {
      c: { value: 'dates', updatedAt: 'x' },
      d: { value: 'earn', updatedAt: 'x' },
    });
    expect(p.uploaded).toBe(2); // ra + rb, any need
    expect(p.verified).toBe(1); // ra
    expect(p.answered).toBe(2); // c + d, any need
    expect(p.required).toBe(2); // a + c
    expect(p.fraction).toBe(1); // both required done
    expect(p.hasInformation).toBe(true);
  });

  it('an unsaved draft or a "needs another" document is not done', () => {
    const p = computeProgress(list(items), [doc('ra', 'rejected')], {});
    expect(p.fraction).toBe(0);
    expect(p.uploaded).toBe(0);
  });

  it('half done', () => {
    const p = computeProgress(list(items), [doc('ra', 'uploaded')], {});
    expect(p.fraction).toBe(0.5);
  });

  it('ignores waived and non-current items', () => {
    const p = computeProgress(
      list([
        item({ checklistItemId: 'a', status: 'waived' }),
        item({ checklistItemId: 'b', current: false }),
        item({ checklistItemId: 'c', documentRequestId: 'rc' }),
      ]),
      [],
      {},
    );
    expect(p.required).toBe(1);
  });

  it('with 0 required items the bar is 0', () => {
    const p = computeProgress(
      list([item({ need: 'optional', required: false })]),
      [],
      {},
    );
    expect(p.required).toBe(0);
    expect(p.fraction).toBe(0);
  });
});
