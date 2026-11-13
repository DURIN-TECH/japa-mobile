// ─────────────────────────────────────────────────────────────────────────────
// Review UI parts (issue #43 design spec, "Components").
//
// Built only from existing Explorer tokens (EX) and primitives. Shared by the
// self-service review card and the review screen.
//
//   ReadinessGauge   130px ring cut into four segments, filled = band level
//   ReadinessMeter   the same four levels as a row of four pill segments
//   ReviewHero       dark gradient hero with the gauge and a "Reviewed" pill
//   RuleQuote        rule reference + verbatim quote + "Read the rule" link
//   FindingCard      one finding; `footer` is the reserved per-item action slot (#44)
//   BlockingRuleCard a fixed rule blocks the application
//   (UpgradePanel and StickyBar moved to explorer/UpgradePrompt.tsx and explorer/StickyBar.tsx)
//   NumberedRow / CheckRow / OutlineButton / SolidButton   small shared pieces
//
// No number is ever drawn for readiness: only the band label and its level.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Linking,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { EX, EXShadow, displayText } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { GlassButton } from '@/components/explorer/primitives';
import type { CountryContext, ReadinessBand } from '@/types/assessment.type';
import {
  BAND_LABEL,
  BAND_LEVEL,
  fmtDate,
} from '@/components/explorer/review/reviewCopy';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Gauge geometry (same as eligibility/result.tsx) ───────────────────────────
const SIZE = 130;
const CENTER = 65;
const R = 52;
const STROKE = 10;
const C = 2 * Math.PI * R;
const GAP = 8; // gap between segments, in px of arc
const SEG = C / 4;

/** One quarter of the ring; fades in as the shared progress passes its turn. */
function GaugeSegment({
  index,
  filled,
  progress,
}: {
  index: number;
  filled: boolean;
  progress: SharedValue<number>;
}) {
  // Dash = one segment minus the gap; offset places it at its quarter.
  const dash = SEG - GAP;
  const offset = -(index * SEG + GAP / 2);
  const props = useAnimatedProps(() => ({
    // Segments fill one after another as progress runs 0 → 1 across the level.
    strokeOpacity: filled
      ? Math.min(1, Math.max(0, progress.value * 4 - index))
      : 0,
  }));
  return (
    <AnimatedCircle
      cx={CENTER}
      cy={CENTER}
      r={R}
      stroke="#ffffff"
      strokeWidth={STROKE}
      fill="none"
      strokeDasharray={`${dash} ${C - dash}`}
      strokeDashoffset={offset}
      animatedProps={props}
    />
  );
}

/** The gauge: four segments, band label in the centre, READINESS under it. */
export function ReadinessGauge({ band }: { band: ReadinessBand | null }) {
  const level = band ? BAND_LEVEL[band] : 0;
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    // 1100ms on the system curve; instant with reduced motion.
    progress.value = reduced
      ? 1
      : withTiming(1, {
          duration: 1100,
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        });
  }, [band, reduced, progress]);

  const label = band ? BAND_LABEL[band] : 'Reviewed';
  return (
    <View
      accessible
      accessibilityLabel={`Readiness: ${label}, level ${level} of 4`}
      style={{
        width: SIZE,
        height: SIZE,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg
        width={SIZE}
        height={SIZE}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        {/* Track: four dim segments */}
        {[0, 1, 2, 3].map((i) => (
          <Circle
            key={`t${i}`}
            cx={CENTER}
            cy={CENTER}
            r={R}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${SEG - GAP} ${C - (SEG - GAP)}`}
            strokeDashoffset={-(i * SEG + GAP / 2)}
          />
        ))}
        {/* Filled segments */}
        {[0, 1, 2, 3].map((i) => (
          <GaugeSegment
            key={`f${i}`}
            index={i}
            filled={i < level}
            progress={progress}
          />
        ))}
      </Svg>
      <View
        style={{
          position: 'absolute',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 22,
        }}
      >
        <Text
          style={{
            fontFamily: EX.font.display.bold,
            fontSize: 22,
            lineHeight: 23,
            color: '#fff',
            textAlign: 'center',
          }}
          numberOfLines={2}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '600',
            letterSpacing: 0.44,
            color: 'rgba(255,255,255,0.85)',
            marginTop: 3,
          }}
        >
          READINESS
        </Text>
      </View>
    </View>
  );
}

/** Four 6px pill segments: filled coral, empty line-08. The band is also a word. */
export function ReadinessMeter({ band }: { band: ReadinessBand | null }) {
  const level = band ? BAND_LEVEL[band] : 0;
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginTop: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 6,
            borderRadius: EX.radius.pill,
            backgroundColor: i < level ? EX.color.primary : EX.color.line08,
          }}
        />
      ))}
    </View>
  );
}

/** Dark hero for every band (a green/red hero would read as approve/refuse). */
export function ReviewHero({
  band,
  reviewedAt,
  stale,
  offline,
  insetTop,
  onBack,
}: {
  band: ReadinessBand | null;
  reviewedAt: string | null;
  stale: boolean;
  offline?: boolean;
  insetTop: number;
  onBack: () => void;
}) {
  const date = fmtDate(reviewedAt);
  const pill = date
    ? `Reviewed ${date}${stale ? ' · out of date' : ''}`
    : stale
      ? 'Out of date'
      : 'Reviewed';
  return (
    <LinearGradient
      colors={[EX.color.dark1, EX.color.dark2]}
      start={{ x: 0.33, y: 0 }}
      end={{ x: 0.67, y: 1 }}
      style={{
        paddingTop: insetTop + 38,
        paddingBottom: 34,
        paddingHorizontal: 22,
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Decorative circle, as in the eligibility result */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -50,
          right: -40,
          width: 190,
          height: 190,
          borderRadius: 95,
          backgroundColor: 'rgba(255,255,255,0.07)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: insetTop + 6,
          left: 18,
          zIndex: 10,
        }}
      >
        <GlassButton icon={Ic.chevL} onPress={onBack} />
      </View>
      <ReadinessGauge band={band} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 16,
          paddingHorizontal: 15,
          paddingVertical: 7,
          borderRadius: EX.radius.pill,
          backgroundColor: 'rgba(255,255,255,0.16)',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
          {pill}
        </Text>
      </View>
      {offline ? (
        <Text
          style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: 12,
            marginTop: 8,
          }}
        >
          You’re offline. Showing your last saved review.
        </Text>
      ) : null}
    </LinearGradient>
  );
}

/**
 * Rule reference, the quote word for word (never truncated), and a link to the
 * source. `onSurface` swaps the cream fill for white inside the blocking card.
 */
export function RuleQuote({
  ruleRef,
  quote,
  url,
  label,
  onSurface = false,
  onOpen,
}: {
  ruleRef: string | null;
  quote: string;
  url: string;
  /** Overrides the heading line (e.g. "You wrote"). */
  label?: string;
  onSurface?: boolean;
  onOpen?: () => void;
}) {
  const head = label ?? ruleRef;
  return (
    <View
      style={{
        backgroundColor: onSurface ? EX.color.cardWhite : EX.color.cream,
        borderWidth: 1,
        borderColor: EX.color.line08,
        borderRadius: EX.radius.chip,
        padding: 12,
        marginTop: 10,
      }}
    >
      {head ? (
        <Text
          style={{
            fontSize: 12,
            fontWeight: '600',
            color: EX.color.inkMuted,
            marginBottom: 4,
          }}
        >
          {head}
        </Text>
      ) : null}
      {quote ? (
        <Text style={{ fontSize: 13, lineHeight: 19, color: EX.color.ink2 }}>
          {`“${quote}”`}
        </Text>
      ) : null}
      {url ? (
        <PressableStatic
          accessibilityRole="link"
          accessibilityLabel={`Read the rule${ruleRef ? `: ${ruleRef}` : ''}`}
          onPress={() => {
            onOpen?.();
            Linking.openURL(url).catch(() => undefined);
          }}
          hitSlop={8}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            marginTop: 10,
            minHeight: 44,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 13.5,
              fontWeight: '600',
              color: EX.color.ink,
              textDecorationLine: 'underline',
            }}
          >
            Read the rule
          </Text>
          <Ic.arrowUR size={15} color={EX.color.primary} strokeWidth={2} />
        </PressableStatic>
      ) : null}
    </View>
  );
}

/** Chip kinds for a finding: rule, officer question, or "couldn't tell". */
export type FindingKind = 'rule' | 'question' | 'unknown' | 'statement';

const CHIP: Record<
  FindingKind,
  { bg: string; fg: string; icon: React.ElementType }
> = {
  rule: { bg: '#FCEAC8', fg: EX.color.amber, icon: Ic.plus },
  question: { bg: '#DCEBF7', fg: '#2F62A0', icon: Ic.search },
  unknown: { bg: EX.color.line06, fg: EX.color.inkMuted, icon: Ic.help },
  statement: { bg: EX.color.line06, fg: EX.color.inkMuted, icon: Ic.docs },
};

/**
 * One finding. Colour sits on the chip only; all text is ink. `footer` is the
 * reserved per-item action slot (Slot B, issue #44): it renders nothing until
 * something is passed.
 */
export function FindingCard({
  kind,
  title,
  body,
  parts,
  children,
  footer,
}: {
  kind: FindingKind;
  title: string;
  body?: string;
  /** Labelled parts, e.g. "Why it may come up" / "What would help". */
  parts?: Array<{ label: string; text: string }>;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const chip = CHIP[kind];
  const Icon = chip.icon;
  return (
    <View
      style={[
        {
          backgroundColor: EX.color.cardWhite,
          borderRadius: EX.radius.card,
          borderWidth: 1,
          borderColor: EX.color.line06,
          paddingVertical: 15,
          paddingHorizontal: 16,
        },
        EXShadow.card,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: chip.bg,
          }}
        >
          <Icon size={15} color={chip.fg} strokeWidth={2.2} />
        </View>
        <Text
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: '700',
            color: EX.color.ink,
          }}
        >
          {title}
        </Text>
      </View>
      {body ? (
        <Text
          style={{
            fontSize: 13,
            lineHeight: 19,
            color: EX.color.ink2,
            marginTop: 8,
          }}
        >
          {body}
        </Text>
      ) : null}
      {parts
        ?.filter((p) => p.text)
        .map((p) => (
          <View key={p.label} style={{ marginTop: 10 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: EX.color.inkMuted,
                marginBottom: 2,
              }}
            >
              {p.label}
            </Text>
            <Text
              style={{ fontSize: 13, lineHeight: 19, color: EX.color.ink2 }}
            >
              {p.text}
            </Text>
          </View>
        ))}
      {children}
      {footer ? <View style={{ marginTop: 12 }}>{footer}</View> : null}
    </View>
  );
}

/** A fixed rule stands in the way: the error chrome at card size. */
export function BlockingRuleCard({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: '#FBE3E1',
        borderWidth: 1,
        borderColor: 'rgba(217,66,91,0.24)',
        borderRadius: EX.radius.card,
        padding: 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: EX.color.cardWhite,
          }}
        >
          <Ic.alert size={15} color="#C0453C" strokeWidth={2.2} />
        </View>
        <Text
          style={{
            flex: 1,
            fontSize: 16,
            fontWeight: '700',
            color: EX.color.ink,
          }}
        >
          {title}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 13,
          lineHeight: 19,
          color: EX.color.ink2,
          marginTop: 8,
        }}
      >
        {body}
      </Text>
      {children}
    </View>
  );
}

/** Numbered row (criteria-row geometry from eligibility/result.tsx). */
export function NumberedRow({ n, label }: { n: number; label: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingVertical: 13,
        paddingHorizontal: 15,
        borderRadius: 15,
        backgroundColor: EX.color.cardWhite,
        borderWidth: 1,
        borderColor: EX.color.line06,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: EX.color.cream,
          borderWidth: 1,
          borderColor: EX.color.line08,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '700', color: EX.color.ink }}>
          {n}
        </Text>
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: '600',
          color: EX.color.ink,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Success-check row (the "What you've got" rows). */
export function CheckRow({ label }: { label: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingVertical: 13,
        paddingHorizontal: 15,
        borderRadius: 15,
        backgroundColor: '#EAF7F0',
        borderWidth: 1,
        borderColor: 'rgba(30,142,85,0.2)',
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#D6F2E2',
        }}
      >
        <Ic.check size={15} color={EX.color.success} strokeWidth={2.6} />
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: '600',
          color: EX.color.ink,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Filled button: coral (the one primary action) or dark ink. */
export function SolidButton({
  label,
  onPress,
  tone = 'coral',
  loading = false,
  disabled = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: 'coral' | 'ink';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ElementType;
  style?: StyleProp<ViewStyle>;
}) {
  const Icon = icon;
  const off = disabled || loading;
  return (
    <PressableStatic
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: loading }}
      style={({ pressed }) => [
        {
          height: 54,
          borderRadius: EX.radius.button,
          backgroundColor: tone === 'coral' ? EX.color.primary : EX.color.ink,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: off ? 0.6 : pressed ? 0.85 : 1,
        },
        tone === 'coral' ? EXShadow.primaryBtn : EXShadow.darkNudge,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : null}
      <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
        {label}
      </Text>
      {Icon && !loading ? (
        <Icon size={18} color="#fff" strokeWidth={1.8} />
      ) : null}
    </PressableStatic>
  );
}

/** Outline button; `height` 46 in cards, 54 on screens. */
export function OutlineButton({
  label,
  onPress,
  height = 46,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  height?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <PressableStatic
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          height,
          borderRadius: 13,
          borderWidth: 1.5,
          borderColor: EX.color.line16,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: EX.color.ink,
          fontSize: height >= 54 ? 15.5 : 14,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </PressableStatic>
  );
}

/**
 * Country context card (#116): published figures, shown exactly as the server
 * sends them. Visually separate from findings (its own white card with a
 * hairline border, no finding chip, no colour accent). It has NO wording of its
 * own about likelihood or the applicant's chances: the headline and every line
 * come from `context.text`; this component only lays them out and adds the
 * source link. Renders nothing unless the note is `available`.
 */
export function CountryContextCard({
  context,
  onOpen,
}: {
  context: CountryContext | undefined;
  onOpen?: () => void;
}) {
  if (!context || context.status !== 'available') return null;
  const { text, source } = context;
  return (
    <View
      accessibilityRole="summary"
      style={{
        backgroundColor: EX.color.cardWhite,
        borderWidth: 1,
        borderColor: EX.color.line08,
        borderRadius: EX.radius.chip,
        padding: 14,
        marginTop: 20,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '700', color: EX.color.ink }}>
        {text.headline}
      </Text>
      {text.lines.map((line, i) => (
        <Text
          key={`${i}-${line.slice(0, 24)}`}
          style={{
            fontSize: 13,
            lineHeight: 19,
            color: EX.color.ink2,
            marginTop: i === 0 ? 8 : 6,
          }}
        >
          {line}
        </Text>
      ))}
      {source.pageUrl ? (
        <PressableStatic
          accessibilityRole="link"
          accessibilityLabel="Open the published data tables"
          onPress={() => {
            onOpen?.();
            Linking.openURL(source.pageUrl).catch(() => undefined);
          }}
          hitSlop={8}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            marginTop: 8,
            minHeight: 44,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 13.5,
              fontWeight: '600',
              color: EX.color.ink,
              textDecorationLine: 'underline',
            }}
          >
            Open the published data tables
          </Text>
          <Ic.arrowUR size={15} color={EX.color.primary} strokeWidth={2} />
        </PressableStatic>
      ) : null}
    </View>
  );
}

/** Small caption under a section title. */
export function Caption({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 13,
        lineHeight: 19,
        color: EX.color.inkMuted,
        marginBottom: 12,
        marginHorizontal: 2,
      }}
    >
      {children}
    </Text>
  );
}

/** Icon + title + body (+ optional reassurance line), centred. No error styling. */
export function ReviewEmpty({
  icon: Icon,
  title,
  body,
  note,
}: {
  icon: React.ElementType;
  title: string;
  body?: string;
  note?: string;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 28,
      }}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 27,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: EX.color.cream,
          borderWidth: 1,
          borderColor: EX.color.line08,
          marginBottom: 14,
        }}
      >
        <Icon size={24} color={EX.color.inkMuted} strokeWidth={1.8} />
      </View>
      <Text style={[displayText(22, 'semibold'), { textAlign: 'center' }]}>
        {title}
      </Text>
      {body ? (
        <Text
          style={{
            fontSize: 14,
            lineHeight: 21,
            color: EX.color.inkMuted,
            textAlign: 'center',
            marginTop: 8,
          }}
        >
          {body}
        </Text>
      ) : null}
      {note ? (
        <Text
          style={{
            fontSize: 13,
            color: EX.color.inkMuted,
            textAlign: 'center',
            marginTop: 6,
          }}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/** Re-export so screens import display text style from one place. */
export { displayText };
