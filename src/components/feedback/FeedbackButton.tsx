// ─────────────────────────────────────────────────────────────────────────────
// FeedbackButton (issue #257) — the small floating button that opens the
// feedback sheet. Dark "ink" circle (never competes with a coral CTA), docked
// to the right edge, above the tab bar and sticky CTA bars.
//
// Position is fixed (the design allows dropping drag); the Settings toggle is
// the escape hatch for a tester it gets in the way of.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FEEDBACK_COPY } from './feedbackLogic';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { Ic } from '@/components/explorer/icons';
import { EX, EXShadow } from '@/components/explorer/theme';

/** Distance above the safe-area bottom: tab bar (116) + 16, above sticky CTA bars (130). */
const BOTTOM_OFFSET = 132;

export function FeedbackButton({
  onPress,
}: {
  /** Called on tap; the host captures the screen, then opens the sheet. */
  onPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <PressableStatic
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={FEEDBACK_COPY.buttonLabel}
      accessibilityHint={FEEDBACK_COPY.buttonHint}
      style={({ pressed }) => [
        {
          position: 'absolute',
          right: 14,
          bottom: insets.bottom + BOTTOM_OFFSET,
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: EX.color.ink,
          // Pressed 0.7. (While the screen is captured the host hides the
          // button entirely, so there is no separate "busy" look.)
          opacity: pressed ? 0.7 : 1,
        },
        EXShadow.darkNudge,
      ]}
    >
      {/* `bg` cream at 90% opacity on the ink fill (17.6:1 contrast) */}
      <Ic.msg size={21} color="rgba(255,251,245,0.9)" strokeWidth={1.8} />
    </PressableStatic>
  );
}
