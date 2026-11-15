// ─────────────────────────────────────────────────────────────────────────────
// "Then you apply" section on the review screen (japa#312).
//
// The closing words of a finished, unblocked review: what Seli has done, that
// Seli doesn't send the application, and where the applicant applies. Words
// only, no link: the official link lives on the self-service screen under
// "Where you apply", and this text points there.
//
// Whether it shows is decided by `showsThenYouApply` (reviewCopy.ts); this
// component only draws it, with the screen's own SectionTitle and Card.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Text } from 'react-native';
import { THEN_YOU_APPLY_TITLE, thenYouApplyBody } from './reviewCopy';
import { EX } from '@/components/explorer/theme';
import { Card, SectionTitle } from '@/components/explorer/primitives';

/**
 * `hasLink`: whether the visa has an official link (`applicationUrl`);
 * `undefined` while that is unknown (visa not loaded), which names no place.
 */
export function ThenYouApply({ hasLink }: { hasLink: boolean | undefined }) {
  return (
    <>
      <SectionTitle>{THEN_YOU_APPLY_TITLE}</SectionTitle>
      <Card>
        {/* Same text style as the "What to do next" card next to it. */}
        <Text style={{ fontSize: 14, lineHeight: 21, color: EX.color.ink2 }}>
          {thenYouApplyBody(hasLink)}
        </Text>
      </Card>
    </>
  );
}
