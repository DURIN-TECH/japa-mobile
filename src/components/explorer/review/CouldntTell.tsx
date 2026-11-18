// ─────────────────────────────────────────────────────────────────────────────
// "What we couldn’t tell" section on the full review (japa#308).
//
// Lists only the items the applicant can act on, chosen by `couldntTell`
// (reviewCopy.ts). When staff-only items were left out, the section ends with
// one calm line (COULDNT_TELL_SKIPPED_LINE) that names no rule and gives no
// count. Three outcomes:
//   actionable items          title, caption, the cards, then the line if any were left out
//   only left-out items       title and the line, nothing else
//   nothing at all            the section is not drawn
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Text, View } from 'react-native';
import { COULDNT_TELL_SKIPPED_LINE, couldntTell } from './reviewCopy';
import { Caption, FindingCard } from './ReviewParts';
import { EX } from '@/components/explorer/theme';
import { SectionTitle } from '@/components/explorer/primitives';
import { LayerPill } from '@/components/explorer/SharedRouteParts';
import { layerLabel } from '@/components/explorer/sharedRouteLogic';
import type { InsufficientItem } from '@/types/assessment.type';
import type { StackLayer } from '@/types/sharedRoute.type';

export function CouldntTell({
  items,
  layers,
}: {
  /** `insufficientInformation` exactly as the server sent it. */
  items: InsufficientItem[] | null | undefined;
  /** japa#237: the stack's layers, for the pill on each card. */
  layers?: StackLayer[];
}) {
  const { shown, anyHidden } = couldntTell(items);
  if (shown.length === 0 && !anyHidden) return null;

  return (
    <>
      <SectionTitle>What we couldn’t tell</SectionTitle>
      {shown.length > 0 ? (
        <>
          <Caption>
            We didn’t have enough to check these. Add what’s missing and the
            next review will cover them.
          </Caption>
          <View style={{ gap: 10 }}>
            {shown.map((i, n) => (
              // The engine doesn't promise a unique criterionId here (one rule
              // can be listed twice), so the key carries the index (japa#308).
              <FindingCard
                key={`${i.criterionId}:${n}`}
                kind="unknown"
                layer={<LayerPill label={layerLabel(layers, i.layerKey)} />}
                title={i.title}
                body={i.reason}
              />
            ))}
          </View>
        </>
      ) : null}
      {anyHidden ? (
        // Same muted style as the section caption; below the cards when
        // there are any, so it reads as a closing note, not a heading.
        <Text
          style={{
            fontSize: 13,
            lineHeight: 19,
            color: EX.color.inkMuted,
            marginTop: shown.length > 0 ? 12 : 0,
            marginHorizontal: 2,
          }}
        >
          {COULDNT_TELL_SKIPPED_LINE}
        </Text>
      ) : null}
    </>
  );
}
