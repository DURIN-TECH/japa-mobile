// Pure label helpers of the duplicate sheet (japa#253).
import { describe, expect, it } from '@jest/globals';
import { duplicateProgressLine } from '../DuplicateApplicationSheet';

describe('duplicateProgressLine', () => {
  it('shows status and progress', () => {
    expect(
      duplicateProgressLine({
        id: 'a',
        status: 'pending_documents',
        progress: 30,
      }),
    ).toBe('Pending documents, 30% complete');
  });
  it('copes with missing parts', () => {
    expect(duplicateProgressLine({ id: 'a', progress: 0 })).toBe('0% complete');
    expect(duplicateProgressLine({ id: 'a' })).toBeUndefined();
    expect(duplicateProgressLine(null)).toBeUndefined();
  });
});
