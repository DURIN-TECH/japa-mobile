// ─────────────────────────────────────────────────────────────────────────────
// japa#310: upload size and type checks, the 413 / 400 lines, and the failed
// review wording per error code (who gets "Try again", who gets support).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/services/api.service', () => ({ apiService: {} }));
jest.mock('@/services/analytics.service', () => ({ analyticsService: {} }));
// SelfServiceCards pulls in ReviewParts, which uses reanimated (absent under jest).
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'View', createAnimatedComponent: (c: unknown) => c },
  useAnimatedStyle: () => ({}),
  useSharedValue: (v: unknown) => ({ value: v }),
  withTiming: (v: unknown) => v,
  Easing: { bezier: () => ({}) },
}));

import {
  FILE_MAX_BYTES,
  IMAGE_MAX_BYTES,
  WRONG_TYPE_COPY,
  isHeic,
  pickedContentType,
  pickedFileProblem,
  tooLargeCopy,
  uploadErrorCopy,
  uploadFailureCopy,
} from '../uploadLimits';
import {
  CONTACT_SUPPORT_LABEL,
  failedCanRetry,
  failedCardCopy,
  failedReasonLine,
} from '../review/reviewCopy';
import { deriveReviewCta } from '../review/SelfServiceCards';
import {
  ASSESSMENT_ERROR_CODES,
  type AssessmentMeta,
} from '@/types/assessment.type';

const MB = 1024 * 1024;

// ── Limits match the backend's numbers ──────────────────────────────────────
describe('upload limits', () => {
  it('are 7 MB for images and 10 MB for anything else, in bytes', () => {
    expect(IMAGE_MAX_BYTES).toBe(7340032);
    expect(FILE_MAX_BYTES).toBe(10485760);
  });

  it('give the right number per type', () => {
    expect(tooLargeCopy(true)).toBe(
      'This file is larger than 7 MB. Upload a smaller copy.',
    );
    expect(tooLargeCopy(false)).toBe(
      'This file is larger than 10 MB. Upload a smaller copy.',
    );
  });
});

// ── The check before asking for an upload URL ──────────────────────────────
describe('pickedFileProblem', () => {
  it('lets a PDF up to 10 MB and an image up to 7 MB through', () => {
    expect(
      pickedFileProblem({
        size: FILE_MAX_BYTES,
        contentType: 'application/pdf',
      }),
    ).toBeNull();
    expect(
      pickedFileProblem({ size: IMAGE_MAX_BYTES, contentType: 'image/jpeg' }),
    ).toBeNull();
    // A 2-4 MB phone photo is fine.
    expect(
      pickedFileProblem({ size: 3.5 * MB, contentType: 'image/png' }),
    ).toBeNull();
  });

  it('refuses a PDF over 10 MB with the 10 MB line', () => {
    expect(
      pickedFileProblem({
        size: FILE_MAX_BYTES + 1,
        contentType: 'application/pdf',
      }),
    ).toBe(tooLargeCopy(false));
  });

  it('refuses an 8 MB image with the 7 MB line', () => {
    expect(pickedFileProblem({ size: 8 * MB, contentType: 'image/jpeg' })).toBe(
      'This file is larger than 7 MB. Upload a smaller copy.',
    );
    expect(
      pickedFileProblem({
        size: IMAGE_MAX_BYTES + 1,
        contentType: 'image/png',
      }),
    ).toBe(tooLargeCopy(true));
  });

  it('lets an unknown size through (the backend checks the real size)', () => {
    expect(
      pickedFileProblem({ size: undefined, contentType: 'application/pdf' }),
    ).toBeNull();
  });

  it('refuses a type the upload URL does not take, whatever its size', () => {
    for (const t of ['image/webp', 'image/gif', 'application/octet-stream'])
      expect(pickedFileProblem({ size: 100, contentType: t })).toBe(
        WRONG_TYPE_COPY,
      );
    // HEIC is accepted by the backend but the review cannot read it.
    expect(pickedFileProblem({ size: 100, contentType: 'image/heic' })).toBe(
      WRONG_TYPE_COPY,
    );
  });
});

// HEIC/HEIF: refused until the app converts it (the model cannot read it).
describe('HEIC and HEIF are refused before upload', () => {
  it('by type', () => {
    for (const t of [
      'image/heic',
      'image/heif',
      'image/HEIC',
      'image/heic-sequence',
      'image/heif-sequence',
    ]) {
      expect(isHeic({ contentType: t })).toBe(true);
      expect(
        pickedFileProblem({ size: 3 * MB, contentType: t, name: 'IMG_1.HEIC' }),
      ).toBe(WRONG_TYPE_COPY);
    }
  });

  it('by extension, whatever type the picker reported', () => {
    for (const name of ['IMG_0042.HEIC', 'photo.heic', 'scan.heif', 'a.HEIF']) {
      expect(isHeic({ contentType: 'image/jpeg', name })).toBe(true);
      expect(
        pickedFileProblem({ size: 3 * MB, contentType: 'image/jpeg', name }),
      ).toBe(WRONG_TYPE_COPY);
    }
    // No type from the picker: a .heic name does not map to an image type.
    expect(pickedContentType({ name: 'IMG_1.heic' })).toBe(
      'application/octet-stream',
    );
  });

  it('a JPEG, PNG or PDF is not mistaken for HEIC', () => {
    expect(isHeic({ contentType: 'image/jpeg', name: 'heic-notes.jpg' })).toBe(
      false,
    );
    expect(
      pickedFileProblem({
        size: 3 * MB,
        contentType: 'image/jpeg',
        name: 'IMG_1.jpg',
      }),
    ).toBeNull();
    expect(
      pickedFileProblem({
        size: MB,
        contentType: 'application/pdf',
        name: 'passport.pdf',
      }),
    ).toBeNull();
  });
});

describe('pickedContentType', () => {
  it('uses the picker type, else the extension', () => {
    expect(pickedContentType({ mimeType: 'image/png', name: 'a.jpg' })).toBe(
      'image/png',
    );
    expect(pickedContentType({ mimeType: null, name: 'Bank.PDF' })).toBe(
      'application/pdf',
    );
    expect(pickedContentType({ name: 'photo.jpeg' })).toBe('image/jpeg');
    expect(pickedContentType({ name: 'noext' })).toBe(
      'application/octet-stream',
    );
  });
});

// ── The line for a failed upload ────────────────────────────────────────────
describe('uploadFailureCopy', () => {
  // What apiService rejects with for the backend's 413.
  const tooLarge = (isImage: boolean) => ({
    code: 'FILE_TOO_LARGE',
    status: 413,
    message: 'This file is larger than 10 MB. Upload a smaller copy, …',
    body: {
      success: false,
      error: 'FILE_TOO_LARGE',
      details: {
        maxBytes: isImage ? IMAGE_MAX_BYTES : FILE_MAX_BYTES,
        sizeBytes: 22020096,
        isImage,
      },
    },
  });

  it('413 FILE_TOO_LARGE shows the size line, not the generic one', () => {
    expect(uploadFailureCopy(tooLarge(false), 'a.pdf', 'application/pdf')).toBe(
      tooLargeCopy(false),
    );
    expect(uploadFailureCopy(tooLarge(true), 'a.jpg', 'image/jpeg')).toBe(
      tooLargeCopy(true),
    );
  });

  it('413 without details falls back to the picked type', () => {
    expect(
      uploadFailureCopy(
        { code: 'FILE_TOO_LARGE', status: 413, message: '' },
        'a.jpg',
        'image/jpeg',
      ),
    ).toBe(tooLargeCopy(true));
  });

  it('a wrong-type 400 from the upload URL shows the type line', () => {
    expect(
      uploadFailureCopy(
        {
          code: 'VALIDATION_ERROR',
          status: 400,
          message: 'Invalid content type. Allowed: application/pdf, image/jpeg',
        },
        'a.webp',
        'image/webp',
      ),
    ).toBe(WRONG_TYPE_COPY);
  });

  it('anything else keeps the generic line', () => {
    expect(
      uploadFailureCopy(
        { code: 'NETWORK_ERROR', status: 0, message: 'x' },
        'a.pdf',
        'application/pdf',
      ),
    ).toBe(uploadErrorCopy('a.pdf'));
    expect(
      uploadFailureCopy(
        {
          code: 'VALIDATION_ERROR',
          status: 400,
          message: 'File not found in storage',
        },
        'a.pdf',
        'application/pdf',
      ),
    ).toBe(uploadErrorCopy('a.pdf'));
    expect(
      uploadFailureCopy(new Error('Storage upload failed'), 'a.pdf', 'x'),
    ).toBe(uploadErrorCopy('a.pdf'));
  });
});

// ── Failed review wording per code ─────────────────────────────────────────
const failed = (code: string | null): AssessmentMeta =>
  ({
    assessmentId: 'a1',
    status: 'failed',
    tier: 'full',
    stale: false,
    staleReason: null,
    startedAt: null,
    finishedAt: null,
    error: code ? { code, message: 'x' } : null,
  }) as unknown as AssessmentMeta;

const PAUSED = /paused/i;

describe('failed review copy (japa#310)', () => {
  it('knows both new codes', () => {
    expect(ASSESSMENT_ERROR_CODES).toContain('too_many_documents');
    expect(ASSESSMENT_ERROR_CODES).toContain('review_too_large');
  });

  it('daily_cap_exceeded keeps "paused, try again tomorrow" and Try again', () => {
    const m = failed('daily_cap_exceeded');
    expect(failedCardCopy(m)).toBe(
      'We couldn’t finish your review. Nothing you added is lost. Reviews are paused for now, so try again tomorrow.',
    );
    expect(failedReasonLine(m)).toBe(
      'Reviews are paused for now. Try again tomorrow.',
    );
    expect(failedCanRetry(m)).toBe(true);
  });

  it('too_many_documents says it plainly, not paused, and offers support', () => {
    const m = failed('too_many_documents');
    expect(failedCardCopy(m)).toBe(
      'We couldn’t finish your review. This application has more documents than one review can read. Nothing you added is lost. Contact support and we’ll help you with it.',
    );
    expect(failedReasonLine(m)).toBe(
      'This application has more documents than one review can read. Contact support and we’ll help you with it.',
    );
    expect(failedCardCopy(m)).not.toMatch(PAUSED);
    expect(failedCardCopy(m)).not.toMatch(/try again/i);
    expect(failedCanRetry(m)).toBe(false);
  });

  it('review_too_large says it plainly, not paused, and offers support', () => {
    const m = failed('review_too_large');
    expect(failedCardCopy(m)).toContain(
      'This application is larger than one review can read.',
    );
    expect(failedReasonLine(m)).toContain(
      'This application is larger than one review can read.',
    );
    expect(failedReasonLine(m)).not.toMatch(PAUSED);
    expect(failedCanRetry(m)).toBe(false);
  });

  it('cost_cap_exceeded (old failures) no longer says paused and keeps Try again', () => {
    const m = failed('cost_cap_exceeded');
    expect(failedCardCopy(m)).toBe(
      'We couldn’t finish your review. Nothing you added is lost. Try again.',
    );
    expect(failedReasonLine(m)).toBe('Something went wrong on our side.');
    expect(failedCanRetry(m)).toBe(true);
  });

  it('an unknown or missing code is retryable with the generic wording', () => {
    expect(failedCanRetry(failed('some_new_code'))).toBe(true);
    expect(failedCanRetry(failed(null))).toBe(true);
    expect(failedCanRetry(null)).toBe(true);
    expect(failedCardCopy(failed('some_new_code'))).toBe(
      'We couldn’t finish your review. Nothing you added is lost. Try again.',
    );
  });
});

describe('deriveReviewCta for a failed review', () => {
  it('Try again when a retry can work (default)', () => {
    expect(deriveReviewCta('failed', false)).toEqual({
      label: 'Try again',
      action: 'retry',
    });
    expect(deriveReviewCta('failed', false, true)).toEqual({
      label: 'Try again',
      action: 'retry',
    });
  });

  it('Contact support when it cannot', () => {
    expect(deriveReviewCta('failed', false, false)).toEqual({
      label: CONTACT_SUPPORT_LABEL,
      action: 'contact',
    });
  });

  it('a submitted application still shows no bar for a failure', () => {
    expect(deriveReviewCta('failed', true, false)).toBeNull();
  });

  it('other states ignore canRetry', () => {
    expect(deriveReviewCta('ready', false, false)?.action).toBe('open');
  });
});
