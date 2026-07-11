// ─────────────────────────────────────────────────────────────────────────────
// Japa / Seli Destination Explorer — design tokens
//
// Ported from the "Seli Design System" Claude Design project (explorer/kit.jsx +
// shell.jsx). This is a self-contained visual language for the Explorer feature:
// a warm coral (#F4516C) + cream (#FFFBF5) palette with a Space Grotesk display
// font. It deliberately does NOT reuse the app's blue theme — the Explorer is a
// standalone experience. Every value here is quoted from the source prototype so
// screens can be rebuilt faithfully.
// ─────────────────────────────────────────────────────────────────────────────

import { Platform, TextStyle, ViewStyle } from 'react-native';

export const EX = {
  color: {
    // ── Brand / accent ──────────────────────────────────────────────────────
    primary: '#F4516C', // coral — CTAs, active tab, progress fills, selection
    primaryDark: '#C0374F', // gradient ends on premium/coral panels
    danger: '#D9425B', // destructive text (sign out)
    // primary tints (translucent) for chips, selected rows, unread bg
    primaryTint05: 'rgba(244,81,108,0.05)',
    primaryTint07: 'rgba(244,81,108,0.07)',
    primaryTint10: 'rgba(244,81,108,0.10)',
    primaryTint12: 'rgba(244,81,108,0.12)',
    primaryTint14: 'rgba(244,81,108,0.14)',
    primaryTint16: 'rgba(244,81,108,0.16)',
    primaryGlow: 'rgba(244,81,108,0.6)', // button drop shadow

    // ── Ink / text ──────────────────────────────────────────────────────────
    ink: '#171326', // primary text, dark cards
    ink2: '#2B2440', // body copy on cards, chip text
    inkMuted: '#5B5468', // descriptions, secondary body
    muted: '#8B8499', // labels, captions, inactive tab, placeholder
    faint: '#A39FB0', // chat timestamps, empty icon color

    // ── Dark surfaces ───────────────────────────────────────────────────────
    dark1: '#241B33', // premium plan gradient start
    dark2: '#14101F', // premium plan gradient end
    profileTop: '#3A2E48', // profile header gradient start
    profileBot: '#241B33', // profile header gradient end

    // ── Surfaces / background ───────────────────────────────────────────────
    bg: '#FFFBF5', // warm off-white app background
    glassWarm: 'rgba(251,247,240,0.82)', // glass headers / tab bar
    glassWarmSoft: 'rgba(251,247,240,0.78)',
    cardWhite: '#ffffff',
    cream: '#FFF6EC', // icon chips, requirement chips, info panels
    flagBg: '#e9e4db',

    // ── Named accents ───────────────────────────────────────────────────────
    teal: '#3FB8AF', // verified badge, online dot, timeline done
    tealDeep: '#1F8A7A',
    tealTint08: 'rgba(63,184,175,0.08)',
    tealTint10: 'rgba(63,184,175,0.10)',
    tealTint14: 'rgba(63,184,175,0.14)',
    gold: '#F2B544', // stars
    success: '#1E8E55', // approved / verified / green CTA
    successDeep: '#14663D',
    purple: '#7B5CD6', // find-agent quick action
    purpleTint: 'rgba(122,92,214,0.12)',
    amber: '#B26A14', // self-service / documents-required text

    // ── Hairlines / dividers ────────────────────────────────────────────────
    line06: 'rgba(23,19,38,0.06)',
    line08: 'rgba(23,19,38,0.08)',
    line10: 'rgba(23,19,38,0.10)',
    line12: 'rgba(23,19,38,0.12)',
    line16: 'rgba(23,19,38,0.16)',
    line24: 'rgba(23,19,38,0.24)',
    track: 'rgba(23,19,38,0.08)', // progress track
  },

  // ── Status color maps (fg on bg) ──────────────────────────────────────────
  status: {
    documents: { label: 'Documents required', fg: '#B26A14', bg: '#FCEAC8' },
    review: { label: 'Under review', fg: '#2F62A0', bg: '#DCEBF7' },
    interview: { label: 'Interview scheduled', fg: '#5A49C4', bg: '#ECE9FB' },
    submitted: { label: 'Submitted', fg: '#1F8A7A', bg: '#D6F0EC' },
    approved: { label: 'Approved', fg: '#1E8E55', bg: '#D6F2E2' },
  } as Record<string, { label: string; fg: string; bg: string }>,

  docStatus: {
    verified: { label: 'Verified', fg: '#1E8E55', bg: '#D6F2E2' },
    uploaded: { label: 'In review', fg: '#2F62A0', bg: '#DCEBF7' },
    rejected: { label: 'Rejected', fg: '#C0453C', bg: '#FBE3E1' },
    missing: { label: 'Not uploaded', fg: '#8B8499', bg: 'rgba(23,19,38,0.06)' },
  } as Record<string, { label: string; fg: string; bg: string }>,

  // ── Typography ────────────────────────────────────────────────────────────
  // Display = Space Grotesk (loaded in (explorer)/_layout.tsx). Body/UI = system
  // font (the prototype used `inherit`, i.e. the platform default).
  font: {
    display: {
      medium: 'SpaceGrotesk_500Medium',
      semibold: 'SpaceGrotesk_600SemiBold',
      bold: 'SpaceGrotesk_700Bold',
    },
    // Body weights use the system font — just set fontWeight.
  },

  // ── Radii ─────────────────────────────────────────────────────────────────
  radius: {
    hero: 26,
    card: 20,
    cardLg: 24,
    cardSm: 18,
    chip: 14,
    chipSm: 10,
    button: 16,
    sheet: 28,
    pill: 999,
    input: 16,
  },

  // ── Spacing ───────────────────────────────────────────────────────────────
  space: {
    screenX: 22, // screen horizontal padding
    tabClear: 116, // bottom scroll padding to clear the tab bar
    ctaClear: 130, // bottom scroll padding to clear a sticky CTA
  },
} as const;

// ── Shadows (RN style objects) ───────────────────────────────────────────────
// iOS uses shadow*, Android uses elevation. Values approximate the CSS spec.
export const EXShadow: Record<string, ViewStyle> = {
  card: Platform.select({
    ios: {
      shadowColor: '#171326',
      shadowOpacity: 0.06,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
    },
    android: { elevation: 1 },
    default: {},
  })!,
  media: Platform.select({
    ios: {
      shadowColor: '#171326',
      shadowOpacity: 0.22,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 14 },
    },
    android: { elevation: 6 },
    default: {},
  })!,
  hero: Platform.select({
    ios: {
      shadowColor: '#171326',
      shadowOpacity: 0.28,
      shadowRadius: 30,
      shadowOffset: { width: 0, height: 20 },
    },
    android: { elevation: 8 },
    default: {},
  })!,
  primaryBtn: Platform.select({
    ios: {
      shadowColor: '#F4516C',
      shadowOpacity: 0.45,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
    },
    android: { elevation: 6 },
    default: {},
  })!,
  darkNudge: Platform.select({
    ios: {
      shadowColor: '#171326',
      shadowOpacity: 0.5,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 14 },
    },
    android: { elevation: 8 },
    default: {},
  })!,
};

// ── Photographic scrim gradients (for expo-linear-gradient) ──────────────────
// Base color rgba(12,10,8,x). Return {colors, locations} tuples.
export const EXScrim = {
  tile: {
    colors: ['rgba(12,10,8,0.74)', 'rgba(12,10,8,0.12)', 'rgba(12,10,8,0.04)'] as const,
    locations: [0, 0.46, 1] as const,
  },
  detail: {
    colors: ['rgba(12,10,8,0.78)', 'rgba(12,10,8,0.15)', 'rgba(12,10,8,0.28)'] as const,
    locations: [0, 0.42, 1] as const,
  },
  // Home hero is diagonal (120deg) — pass start/end when using.
  homeHero: {
    colors: ['rgba(12,10,8,0.80)', 'rgba(12,10,8,0.34)', 'rgba(12,10,8,0.12)'] as const,
    locations: [0, 0.58, 1] as const,
  },
};

// ── Type presets (helpers) ───────────────────────────────────────────────────
export const displayText = (
  size: number,
  weight: 'medium' | 'semibold' | 'bold' = 'semibold',
): TextStyle => ({
  fontFamily: EX.font.display[weight],
  fontSize: size,
  color: EX.color.ink,
  letterSpacing: -size * 0.015,
});
