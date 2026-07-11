// ─────────────────────────────────────────────────────────────────────────────
// Seli brand mark — inlined from seli-brand-pack/mark/svg via react-native-svg's
// SvgXml (the glyph is tiny, so we avoid a bundled asset). Rounded-square mark
// with the "S" flow + accent nodes. `color` = blue on white/brand fill;
// `inverse` = white square with blue stroke (for light-on-dark contexts).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { SvgXml } from 'react-native-svg';

const COLOR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#2563eb"/><path d="M22.5 9.3 C 19.5 5.8, 12.7 6.7, 11.6 11.2 C 10.6 15.2, 18.8 15.4, 20.4 19.4 C 22.0 23.5, 14.6 26.7, 9.5 22.7" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="22.5" cy="9.3" r="2.4" fill="#2563eb" stroke="#ffffff" stroke-width="1.4"/><circle cx="9.5" cy="22.7" r="2.7" fill="#16a34a" stroke="#ffffff" stroke-width="1.2"/></svg>`;

const INVERSE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#ffffff" stroke="rgba(15,23,42,0.08)" stroke-width="0.4"/><path d="M22.5 9.3 C 19.5 5.8, 12.7 6.7, 11.6 11.2 C 10.6 15.2, 18.8 15.4, 20.4 19.4 C 22.0 23.5, 14.6 26.7, 9.5 22.7" fill="none" stroke="#2563eb" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="22.5" cy="9.3" r="2.4" fill="#ffffff" stroke="#2563eb" stroke-width="1.4"/><circle cx="9.5" cy="22.7" r="2.7" fill="#16a34a" stroke="#2563eb" stroke-width="1.2"/></svg>`;

export function SeliMark({ size = 32, variant = 'color' }: { size?: number; variant?: 'color' | 'inverse' }) {
  return <SvgXml xml={variant === 'inverse' ? INVERSE : COLOR} width={size} height={size} />;
}
