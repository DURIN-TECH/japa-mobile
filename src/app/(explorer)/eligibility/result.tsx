// ─────────────────────────────────────────────────────────────────────────────
// Eligibility result (prototype eligibility.jsx → EligibilityResult).
//
// Green gradient top with a circular SVG gauge that animates up to the match
// score (the score + "MATCH SCORE" label live inside the gauge), a verdict pill,
// then the content: summary, "What you've got" (matched criteria), "To strengthen
// your case" (gaps), and a dark agent-nudge card. A sticky coral CTA sends the
// user into the self-service flow.
//
// The gauge is real react-native-svg (Svg + Circle) driven by Reanimated: the
// foreground arc's stroke-dashoffset animates from fully-hidden to score/100.
// Geometry mirrors the source: svg 130×130, r=52, strokeWidth 10, rotated -90°.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import { ELIG_RESULT, agentById } from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import {
  GlassButton,
  Portrait,
  SectionTitle,
} from '@/components/explorer/primitives';
// ── Live backend wiring ───────────────────────────────────────────────────────
// When the wizard submitted a real eligibility check it routes here with a
// `checkId`. We fetch that scored EligibilityCheck and derive the display from
// it; without a checkId we render the static demo result (ELIG_RESULT).
import { useEligibilityCheck } from '@/hooks/useEligibility';
import { EligibilityLevel } from '@/types/eligibility.type';

// Animate the SVG circle's dash offset (the arc "unrolls" to the score).
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Gauge geometry (quoted from the source SVG) ───────────────────────────────
const SIZE = 130; // svg width/height (viewBox 0 0 130 130)
const CENTER = 65; // cx / cy
const R = 52; // radius
const STROKE = 10; // arc thickness
const C = 2 * Math.PI * R; // circumference → strokeDasharray

// ── CircularGauge — track + animated white arc, score + label centred inside ──
function CircularGauge({ score }: { score: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    // Ease the arc from 0 → score/100 shortly after mount.
    progress.value = withTiming(score / 100, {
      duration: 1100,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
    });
  }, [score, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: C * (1 - progress.value),
  }));

  return (
    <View
      style={{
        width: SIZE,
        height: SIZE,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Rotate -90° so the arc starts at 12 o'clock (text is a separate overlay). */}
      <Svg
        width={SIZE}
        height={SIZE}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        {/* Track */}
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={R}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={STROKE}
          fill="none"
        />
        {/* Animated foreground arc */}
        <AnimatedCircle
          cx={CENTER}
          cy={CENTER}
          r={R}
          stroke="#ffffff"
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          animatedProps={animatedProps}
        />
      </Svg>
      {/* Score + label overlay (absolute so gauge rotation doesn't affect it) */}
      <View
        style={{
          position: 'absolute',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: EX.font.display.bold,
            fontSize: 38,
            lineHeight: 40,
            color: '#fff',
          }}
        >
          {score}
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '600',
            letterSpacing: 0.44, // 0.04em × 11
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          MATCH SCORE
        </Text>
      </View>
    </View>
  );
}

// ── CriteriaRow — one matched / gap item with a tinted round icon chip ────────
// Source: radius 15, padding 13×15, gap 11; chip = 26px circle; label 14/600.
function CriteriaRow({
  label,
  icon: IconCmp,
  tint,
  chip,
  bg,
  border,
  textColor,
}: {
  label: string;
  icon: React.ElementType;
  tint: string;
  chip: string;
  bg: string;
  border: string;
  textColor: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingVertical: 13,
        paddingHorizontal: 15,
        borderRadius: 15,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: chip,
        }}
      >
        <IconCmp size={15} color={tint} strokeWidth={2.4} />
      </View>
      <Text
        style={{ flex: 1, fontSize: 14, fontWeight: '600', color: textColor }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function EligibilityResult() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { dest, checkId } = useLocalSearchParams<{
    dest?: string;
    checkId?: string;
  }>();

  // Fetch the real scored check when a checkId was passed (enabled by the id).
  const checkQ = useEligibilityCheck(checkId ?? '');

  // Derive the display from the live EligibilityCheck when available, else fall
  // back to the static demo result. Kept in a memo so it only recomputes when the
  // fetched data changes.
  const { score, verdict, summary, matched, gaps } = useMemo(() => {
    const c = checkId ? checkQ.data : undefined;
    if (!c) return ELIG_RESULT;

    // eligibilityLevel → verdict pill copy.
    const verdictMap: Record<EligibilityLevel, string> = {
      high: 'Likely eligible',
      medium: 'Possibly eligible',
      low: 'Needs work',
      not_applicable: 'No visa required',
    };
    // Generic one-liner used when the backend returned no recommendations.
    const genericMap: Record<EligibilityLevel, string> = {
      high: 'Based on your answers, you have a strong profile for this visa.',
      medium:
        'Based on your answers, you may be eligible with a few improvements.',
      low: 'Based on your answers, your profile needs work — an expert can help.',
      not_applicable:
        'Based on your answers, you may not need a visa for this trip.',
    };

    const matchedItems = c.breakdown.filter((b) => b.passed).map((b) => b.question);
    // Prefer explicit missing requirements; fall back to failed breakdown items.
    const gapItems = c.missingRequirements?.length
      ? c.missingRequirements
      : c.breakdown.filter((b) => !b.passed).map((b) => b.question);

    return {
      score: c.score,
      verdict: verdictMap[c.eligibilityLevel] ?? ELIG_RESULT.verdict,
      summary:
        c.recommendations?.[0] ??
        genericMap[c.eligibilityLevel] ??
        ELIG_RESULT.summary,
      matched: matchedItems,
      gaps: gapItems,
    };
  }, [checkId, checkQ.data]);

  const agent = agentById('a1'); // nudge agent — Sarah Johnson
  const firstName = agent?.n.split(' ')[0] ?? 'an expert';

  // Spinner while the live check is loading (all hooks above already ran).
  if (checkId && checkQ.isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: EX.color.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={EX.color.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
      >
        {/* ── Green gradient top (160deg #1E8E55 → #14663D, padding 92/22/40) ── */}
        <LinearGradient
          colors={[EX.color.success, EX.color.successDeep]}
          start={{ x: 0.33, y: 0 }}
          end={{ x: 0.67, y: 1 }}
          style={{
            paddingTop: insets.top + 38, // ≈ 92px from screen top incl. status bar
            paddingBottom: 40,
            paddingHorizontal: 22,
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Single decorative translucent circle — top-right, 190px */}
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

          {/* Glass back — top-left (source top 54 / left 18) */}
          <View
            style={{
              position: 'absolute',
              top: insets.top + 6,
              left: 18,
              zIndex: 10,
            }}
          >
            <GlassButton icon={Ic.chevL} onPress={() => router.back()} />
          </View>

          {/* Gauge (score + MATCH SCORE inside) */}
          <CircularGauge score={score} />

          {/* Verdict pill — rgba(255,255,255,0.16), check2 + verdict */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              marginTop: 16,
              paddingHorizontal: 15,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.16)',
            }}
          >
            <Ic.check2 size={17} color="#fff" strokeWidth={2} />
            <Text style={{ fontSize: 14.5, fontWeight: '700', color: '#fff' }}>
              {verdict}
            </Text>
          </View>
        </LinearGradient>

        {/* ── Content — source padding 22px 22px 130px ──────────────────────── */}
        <View style={{ paddingTop: 22, paddingHorizontal: 22 }}>
          {/* Summary paragraph — 14.5 / lineHeight 1.6 / #5B5468 */}
          <Text
            style={{
              fontSize: 14.5,
              lineHeight: 23.2,
              color: EX.color.inkMuted,
            }}
          >
            {summary}
          </Text>

          {/* What you've got — matched criteria (green) */}
          <SectionTitle>What you&apos;ve got</SectionTitle>
          <View style={{ gap: 9 }}>
            {matched.map((m) => (
              <CriteriaRow
                key={m}
                label={m}
                icon={Ic.check}
                tint={EX.color.success}
                chip="#D6F2E2"
                bg={EX.color.cardWhite}
                border="rgba(23,19,38,0.07)"
                textColor={EX.color.ink}
              />
            ))}
          </View>

          {/* To strengthen your case — gaps (cream/amber) */}
          <SectionTitle>To strengthen your case</SectionTitle>
          <View style={{ gap: 9 }}>
            {gaps.map((g) => (
              <CriteriaRow
                key={g}
                label={g}
                icon={Ic.plus}
                tint={EX.color.amber}
                chip="#FCEAC8"
                bg={EX.color.cream}
                border="rgba(178,106,20,0.18)"
                textColor="#7A5A2E"
              />
            ))}
          </View>

          {/* Dark agent-nudge card — eyebrow + title + coral chevron circle */}
          {agent ? (
            <Pressable
              onPress={() => router.push(`/(explorer)/agent/${agent.id}`)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 13,
                marginTop: 22,
                padding: 15,
                borderRadius: EX.radius.card, // 20
                backgroundColor: EX.color.ink,
                shadowColor: '#171326',
                shadowOpacity: 0.4,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 14 },
                elevation: 8,
              }}
            >
              <Portrait seed={agent.seed} size={44} name={agent.n} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: '600',
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >
                  Recommended next step
                </Text>
                <Text
                  style={{
                    fontSize: 14.5,
                    fontWeight: '700',
                    color: '#fff',
                    marginTop: 2,
                  }}
                >
                  Have {firstName} review your case
                </Text>
              </View>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: EX.color.primary,
                }}
              >
                <Ic.chevR size={18} color="#fff" strokeWidth={1.8} />
              </View>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Sticky coral CTA — glass bar over the content ────────────────────── */}
      <BlurView
        intensity={30}
        tint="light"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: 15,
          paddingHorizontal: 22,
          paddingBottom: Math.max(insets.bottom, 16) + 6,
          backgroundColor: EX.color.glassWarmSoft,
          borderTopWidth: 1,
          borderTopColor: EX.color.line06,
        }}
      >
        <Pressable
          onPress={() => router.push(`/(explorer)/self-service/${dest}`)}
          style={{
            height: 54,
            borderRadius: EX.radius.button, // 16
            backgroundColor: EX.color.primary,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            shadowColor: EX.color.primary,
            shadowOpacity: 0.45,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
            elevation: 6,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
            Start my application
          </Text>
          <Ic.arrow size={18} color="#fff" strokeWidth={1.8} />
        </Pressable>
      </BlurView>
    </View>
  );
}
