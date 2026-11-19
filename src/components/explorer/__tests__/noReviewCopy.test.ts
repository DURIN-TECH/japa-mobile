// "No review for this visa yet" copy for 404 NO_APPROVED_RUBRIC (issue #251).
// Guards the honest wording: the old text claimed Seli was "still checking the
// published rules", but the route simply has no rulebook yet.
import { describe, expect, it } from '@jest/globals';
import { NO_REVIEW_BODY, NO_REVIEW_TITLE } from '../review/reviewCopy';

describe('no-review copy', () => {
  it('says the review is not available, not that checking is unfinished', () => {
    expect(NO_REVIEW_TITLE).toBe('Review not available for this visa yet');
    expect(NO_REVIEW_BODY).toContain('doesn’t have a review for this visa yet');
    expect(NO_REVIEW_BODY).not.toMatch(/finished checking|published rules/i);
  });

  it('still tells the user they can prepare and upload documents', () => {
    expect(NO_REVIEW_BODY).toMatch(/prepare your answers/);
    expect(NO_REVIEW_BODY).toMatch(/upload your documents/);
  });

  it('avoids decision words banned by reviewCopy.ts', () => {
    expect(`${NO_REVIEW_TITLE} ${NO_REVIEW_BODY}`).not.toMatch(
      /verdict|refus|approv|likely|chance|genuine|score/i,
    );
  });
});
