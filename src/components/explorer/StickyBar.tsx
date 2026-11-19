// ─────────────────────────────────────────────────────────────────────────────
// StickyBar — the glass bottom bar the self-service flow uses for its one
// primary action (coral CTA, optional counter / inline error above it).
//
// INTEGRATION: the review, statement and intake screens (issues #43, #113) each
// built their own copy of this bar. This is the single copy; the bar's look is
// the one the self-service screen already had.
//
//   floating (default)  absolutely positioned over the scroll content, as on the
//                       review and statement screens. The screen must leave
//                       `EX.space.ctaClear` of bottom padding.
//   inline              laid out in the normal flow under the scroll view, as on
//                       the intake screen (a flex column inside a
//                       KeyboardAvoidingView), so the list above ends where the
//                       bar begins.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View } from 'react-native';
import { BlurView } from 'expo-blur';
import { EX } from '@/components/explorer/theme';

export function StickyBar({
  children,
  insetBottom,
  inline = false,
}: {
  children: React.ReactNode;
  /** Bottom safe-area inset (from `useSafeAreaInsets`). */
  insetBottom: number;
  /** Lay the bar out in the flow instead of floating over the content. */
  inline?: boolean;
}) {
  const style = {
    paddingTop: 15,
    paddingHorizontal: 22,
    paddingBottom: Math.max(insetBottom, 16) + 6,
    backgroundColor: EX.color.glassWarm,
    borderTopWidth: 1,
    borderTopColor: EX.color.line06,
    ...(inline
      ? {}
      : { position: 'absolute' as const, left: 0, right: 0, bottom: 0 }),
  };
  // Inline bars need no blur (nothing scrolls underneath them).
  if (inline) return <View style={style}>{children}</View>;
  return (
    <BlurView intensity={30} tint="light" style={style}>
      {children}
    </BlurView>
  );
}
