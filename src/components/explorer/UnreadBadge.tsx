// ─────────────────────────────────────────────────────────────────────────────
// Bell unread badge (#269): a coral number pill on the Home bell button.
// `badgeText` / `bellLabel` hold the rules (1–9 shown, 10+ → "9+", nothing for
// 0 / negative / not a number) so they can be unit tested. The pill is hidden
// from screen readers; the count is in the bell's accessibility label instead.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Text, View } from 'react-native';
import { EX } from './theme';

/** "1".."9", "9+" for 10 or more, null when there is nothing to show. */
export function badgeText(count: unknown): string | null {
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 1) {
    return null;
  }
  return count >= 10 ? '9+' : String(Math.floor(count));
}

/** Accessibility label for the bell button. */
export function bellLabel(count: unknown): string {
  const t = badgeText(count);
  if (!t) return 'Notifications';
  return t === '9+'
    ? 'Notifications, more than 9 unread'
    : `Notifications, ${t} unread`;
}

/** Absolute-positioned pill; place inside a 42px relative parent. */
export function UnreadBadge({ count }: { count: unknown }) {
  const text = badgeText(count);
  if (!text) return null;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        top: -4,
        right: -4,
        height: 18,
        minWidth: 18,
        borderRadius: 9,
        paddingHorizontal: 5,
        backgroundColor: EX.color.primary,
        borderWidth: 2,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        maxFontSizeMultiplier={1.2}
        style={{
          color: '#fff',
          fontSize: 11,
          fontWeight: '700',
          lineHeight: 14,
          textAlign: 'center',
          fontVariant: ['tabular-nums'],
        }}
      >
        {text}
      </Text>
    </View>
  );
}
