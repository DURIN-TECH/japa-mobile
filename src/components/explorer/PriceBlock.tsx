// ─────────────────────────────────────────────────────────────────────────────
// PriceBlock — the stacked price pattern (japa#183 design spec).
//
//   ₦47,389          ← primary: the local amount (ink, bold)
//   about $35        ← secondary: the dollar price (label 12.5/600, ink-muted)
//
// Every stacked price (sticky bars, the pay summary, history rows) renders
// through this so the dollar line cannot drift between screens. It only
// RENDERS `PriceParts` (explorer/content.ts → `priceParts`): no maths, no
// rate. Text colours are `ink` / `ink-muted` only (never `muted`: 3.48:1 on
// `bg`, below AA). When a local figure was expected but the server had no
// rate, `unavailableNote` (e.g. "Naira price unavailable") shows in
// status-error-fg under the dollar price; it is a note, not an error state.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Text, View } from 'react-native';
import { EX } from './theme';
import type { PriceParts } from './content';

export function PriceBlock({
  parts,
  primarySize = 21,
  align = 'left',
  unavailableNote,
}: {
  /** What to show, from `priceParts(local, usd, opts)`. */
  parts: PriceParts;
  /** Primary line font size (21 bar value, 15 row-label, 18 section-title). */
  primarySize?: number;
  /** Text alignment of both lines ('right' for amount columns). */
  align?: 'left' | 'right';
  /** Copy under the dollar price when the local figure is unavailable. */
  unavailableNote?: string;
}) {
  const textAlign = align;
  return (
    <View style={{ alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {/* Primary — the local amount (or the dollar price / "Free"). */}
      <Text
        style={{
          fontSize: primarySize,
          fontWeight: '700',
          color: EX.color.ink,
          letterSpacing: -0.2,
          textAlign,
          fontVariant: ['tabular-nums'],
        }}
      >
        {parts.primary}
      </Text>
      {/* Secondary — the dollar price ("about $35" or "$35.00"). */}
      {parts.secondary ? (
        <Text
          style={{
            fontSize: 12.5,
            fontWeight: '600',
            color: EX.color.inkMuted,
            marginTop: 2,
            textAlign,
          }}
        >
          {parts.secondary}
        </Text>
      ) : null}
      {/* Local figure expected but the server had no rate: say so, calmly. */}
      {parts.localUnavailable && unavailableNote ? (
        <Text
          style={{
            fontSize: 12.5,
            fontWeight: '600',
            // status-error-fg (tokens.json), same value as docStatus.rejected.
            color: EX.docStatus.rejected.fg,
            marginTop: 2,
            textAlign,
          }}
        >
          {unavailableNote}
        </Text>
      ) : null}
    </View>
  );
}
