import { useEffect, useRef, useState } from 'react';
import { PanResponder, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, ChevronLeft } from 'lucide-react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  SceneAgents,
  SceneDiscover,
  SceneDocuments,
  SceneProtect,
  SceneTrack,
} from './scenes';

type Step = {
  key: string;
  Anim: (props: { playing: boolean }) => React.ReactElement;
  eyebrow: string;
  title: string;
  body: string;
  // When true the illustration area is not aspect-ratio constrained and the
  // scene fills the full available space.
  fullBleed?: boolean;
};

const STEPS: Step[] = [
  {
    key: 'discover',
    Anim: SceneDiscover,
    eyebrow: 'Discover',
    title: 'Every visa, one place',
    body: 'Browse 200+ visa types across 80 countries. See requirements, costs, and processing times before you start.',
  },
  {
    key: 'documents',
    Anim: SceneDocuments,
    eyebrow: 'Prepare',
    title: 'A checklist that knows your case',
    body: 'Get a tailored document list for your visa. Upload from your phone and we keep everything organized.',
  },
  {
    key: 'agents',
    Anim: SceneAgents,
    eyebrow: 'Connect',
    title: 'Verified immigration agents',
    body: 'Book a 30-minute consultation or hand off the full application. Every agent is vetted, rated, and reviewed.',
  },
  {
    key: 'track',
    Anim: SceneTrack,
    eyebrow: 'Track',
    title: 'Real progress, in real time',
    body: 'Follow every step from submission to approval. Push alerts the moment anything changes.',
  },
  {
    key: 'protect',
    Anim: SceneProtect,
    eyebrow: 'Protect',
    title: 'Escrow-backed payments',
    body: 'Your money is held securely and only released when work is delivered. Cancel any time before a milestone.',
    fullBleed: true,
  },
];

type TravelerSpec = {
  x: number;
  y: number;
  scale: number;
  rot: number;
  opacity: number;
};

const TRAVELERS: Record<'stamp' | 'check' | 'avatar' | 'coin', TravelerSpec[]> =
  {
    stamp: [
      { x: 12, y: 8, scale: 0.9, rot: -18, opacity: 1 },
      { x: 82, y: 20, scale: 0.8, rot: 10, opacity: 1 },
      { x: 90, y: 12, scale: 0.55, rot: 18, opacity: 0.5 },
      { x: 94, y: 6, scale: 0.4, rot: 24, opacity: 0.3 },
      { x: 96, y: 4, scale: 0.3, rot: 28, opacity: 0.15 },
    ],
    check: [
      { x: 88, y: 82, scale: 0.5, rot: 0, opacity: 0 },
      { x: 76, y: 28, scale: 1, rot: 0, opacity: 1 },
      { x: 52, y: 18, scale: 0.85, rot: 0, opacity: 1 },
      { x: 88, y: 18, scale: 0.8, rot: 0, opacity: 1 },
      { x: 50, y: 50, scale: 1.1, rot: 0, opacity: 1 },
    ],
    avatar: [
      { x: 90, y: 84, scale: 0.45, rot: 6, opacity: 0.35 },
      { x: 14, y: 84, scale: 0.5, rot: -4, opacity: 0.6 },
      { x: 50, y: 54, scale: 1, rot: 0, opacity: 1 },
      { x: 14, y: 30, scale: 0.7, rot: 0, opacity: 1 },
      { x: 12, y: 78, scale: 0.55, rot: 0, opacity: 0.85 },
    ],
    coin: [
      { x: 86, y: 82, scale: 0.4, rot: -10, opacity: 0.5 },
      { x: 88, y: 88, scale: 0.45, rot: 6, opacity: 0.6 },
      { x: 86, y: 84, scale: 0.7, rot: -6, opacity: 1 },
      { x: 82, y: 30, scale: 0.6, rot: 10, opacity: 1 },
      { x: 88, y: 82, scale: 1, rot: 12, opacity: 1 },
    ],
  };

type Props = {
  onFinish: () => void;
};

export function IntroFlow({ onFinish }: Props) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  const go = (n: number) => {
    const next = Math.max(0, Math.min(STEPS.length - 1, n));
    setStep(next);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        if (g.dx > 40) {
          setStep((s) => Math.max(0, s - 1));
        } else if (g.dx < -40) {
          setStep((s) => Math.min(STEPS.length - 1, s + 1));
        }
      },
    }),
  ).current;

  return (
    <LinearGradient colors={['#f4f6fb', '#eef2fa']} style={{ flex: 1 }}>
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        {/* Top bar: brand + skip */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 64,
            paddingHorizontal: 20,
            paddingBottom: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: '#2563eb',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: '#fff',
                  fontWeight: '800',
                  fontSize: 16,
                  letterSpacing: -0.3,
                }}
              >
                J
              </Text>
            </View>
            <Text style={{ fontWeight: '700', fontSize: 16, color: '#030712' }}>
              Seli
            </Text>
          </View>
          {!isLast && (
            <TouchableOpacity
              onPress={onFinish}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text
                style={{ fontSize: 15, fontWeight: '500', color: '#6b7280' }}
              >
                Skip
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Slide stack */}
        <View style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {STEPS.map((_, i) => (
            <IntroSlide key={i} step={i} active={i === step} />
          ))}
          <TravelerLayer step={step} />
        </View>

        {/* Bottom: progress + CTA */}
        <View
          style={{
            paddingHorizontal: 24,
            paddingBottom: 32,
            paddingTop: 12,
            gap: 18,
          }}
        >
          <ProgressDots step={step} total={STEPS.length} onDot={go} />

          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {step > 0 && (
              <TouchableOpacity
                onPress={() => go(step - 1)}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  backgroundColor: '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ChevronLeft size={20} color="#374151" strokeWidth={2.2} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => (isLast ? onFinish() : go(step + 1))}
              activeOpacity={0.9}
              style={{
                flex: 1,
                height: 52,
                borderRadius: 26,
                backgroundColor: '#2563eb',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                shadowColor: '#2563eb',
                shadowOpacity: 0.28,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: 6,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                {isLast ? 'Get Started' : 'Continue'}
              </Text>
              {!isLast && (
                <ArrowRight size={18} color="#fff" strokeWidth={2.4} />
              )}
            </TouchableOpacity>
          </View>

          {isLast && (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: '#6b7280' }}>
                Already have an account?{' '}
                <Text
                  onPress={onFinish}
                  style={{ color: '#2563eb', fontWeight: '600' }}
                >
                  Log in
                </Text>
              </Text>
            </View>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

function ProgressDots({
  step,
  total,
  onDot,
}: {
  step: number;
  total: number;
  onDot: (n: number) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <Dot
          key={i}
          active={i === step}
          done={i < step}
          onPress={() => onDot(i)}
        />
      ))}
    </View>
  );
}

function Dot({
  active,
  done,
  onPress,
}: {
  active: boolean;
  done: boolean;
  onPress: () => void;
}) {
  const width = useSharedValue(active ? 28 : 8);
  const colorProgress = useSharedValue(active ? 1 : done ? 0.5 : 0);

  useEffect(() => {
    width.value = withTiming(active ? 28 : 8, {
      duration: 400,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
    });
    colorProgress.value = withTiming(active ? 1 : done ? 0.5 : 0, {
      duration: 300,
    });
  }, [active, done, width, colorProgress]);

  const style = useAnimatedStyle(() => {
    const bg =
      colorProgress.value === 1
        ? '#2563eb'
        : colorProgress.value === 0.5
          ? '#93c5fd'
          : '#e5e7eb';
    return {
      width: width.value,
      height: 4,
      borderRadius: 4,
      backgroundColor: bg,
    };
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 16, bottom: 16, left: 4, right: 4 }}
    >
      <Animated.View style={style} />
    </TouchableOpacity>
  );
}

function IntroSlide({ step, active }: { step: number; active: boolean }) {
  const { Anim, eyebrow, title, body, fullBleed } = STEPS[step];

  const opacity = useSharedValue(active ? 1 : 0);
  const tx = useSharedValue(active ? 0 : 40);

  useEffect(() => {
    opacity.value = withTiming(active ? 1 : 0, { duration: 500 });
    tx.value = withTiming(active ? 0 : 40, {
      duration: 500,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
    });
  }, [active, opacity, tx]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: tx.value }],
  }));

  return (
    <Animated.View
      pointerEvents={active ? 'auto' : 'none'}
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'column',
        },
        style,
      ]}
    >
      {/* illustration */}
      <View
        style={{
          flex: 1,
          minHeight: 280,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: fullBleed ? 0 : 12,
          paddingHorizontal: fullBleed ? 0 : 20,
        }}
      >
        <View
          style={
            fullBleed
              ? { width: '100%', height: '100%' }
              : { width: '100%', maxWidth: 360, aspectRatio: 360 / 280 }
          }
        >
          <Anim playing={active} />
        </View>
      </View>

      {/* copy */}
      <View
        style={{
          paddingHorizontal: 28,
          paddingTop: 8,
          paddingBottom: 32,
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: '600',
            letterSpacing: 1.5,
            color: '#2563eb',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          {eyebrow}
        </Text>
        <Text
          style={{
            fontSize: 26,
            fontWeight: '700',
            color: '#030712',
            lineHeight: 32,
            letterSpacing: -0.3,
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 15,
            lineHeight: 22,
            color: '#4b5563',
            textAlign: 'center',
          }}
        >
          {body}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// Shared-element travelers: morph between screens
// ─────────────────────────────────────────────
function TravelerLayer({ step }: { step: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 3,
      }}
    >
      <Traveler kind="stamp" step={step} />
      <Traveler kind="check" step={step} />
      <Traveler kind="avatar" step={step} />
      <Traveler kind="coin" step={step} />
    </View>
  );
}

function Traveler({
  kind,
  step,
}: {
  kind: keyof typeof TRAVELERS;
  step: number;
}) {
  const spec = TRAVELERS[kind][step] ?? TRAVELERS[kind][0];

  const left = useSharedValue(spec.x);
  const top = useSharedValue(spec.y);
  const scale = useSharedValue(spec.scale);
  const rot = useSharedValue(spec.rot);
  const op = useSharedValue(spec.opacity);

  useEffect(() => {
    const t = { duration: 900, easing: Easing.bezier(0.7, 0.05, 0.3, 1) };
    left.value = withTiming(spec.x, t);
    top.value = withTiming(spec.y, t);
    scale.value = withTiming(spec.scale, t);
    rot.value = withTiming(spec.rot, t);
    op.value = withTiming(spec.opacity, { duration: 700 });
  }, [spec, left, top, scale, rot, op]);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: `${left.value}%`,
    top: `${top.value}%`,
    opacity: op.value,
    transform: [
      { translateX: -22 },
      { translateY: -22 },
      { scale: scale.value },
      { rotate: `${rot.value}deg` },
    ],
  }));

  return (
    <Animated.View style={style}>
      {kind === 'stamp' && (
        <Svg width={64} height={44} viewBox="-32 -22 64 44">
          <Rect
            x={-28}
            y={-18}
            width={56}
            height={36}
            rx={4}
            fill="#fff"
            stroke="#16a34a"
            strokeWidth={2}
            strokeDasharray="2.5 2.5"
          />
          <SvgText
            x={0}
            y={1}
            textAnchor="middle"
            fontSize={9}
            fontWeight="800"
            fill="#16a34a"
            letterSpacing={0.5}
          >
            APPROVED
          </SvgText>
          <SvgText
            x={0}
            y={11}
            textAnchor="middle"
            fontSize={6}
            fill="#16a34a"
            opacity={0.75}
          >
            USA · 2026
          </SvgText>
        </Svg>
      )}
      {kind === 'check' && (
        <Svg width={44} height={44} viewBox="-22 -22 44 44">
          <Circle r={20} fill="#16a34a" />
          <Circle
            r={20}
            fill="none"
            stroke="#fff"
            strokeOpacity={0.35}
            strokeWidth={2}
          />
          <Path
            d="M-7 1 l4 4 l10 -10"
            fill="none"
            stroke="#fff"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      )}
      {kind === 'avatar' && (
        <Svg width={56} height={56} viewBox="-28 -28 56 56">
          <Circle r={26} fill="#fff" />
          <Circle r={24} fill="#2563eb" />
          <SvgText
            y={6}
            textAnchor="middle"
            fontSize={14}
            fontWeight="700"
            fill="#fff"
          >
            SJ
          </SvgText>
          <G transform="translate(18 -16)">
            <Circle r={7} fill="#16a34a" stroke="#fff" strokeWidth={2} />
            <Path
              d="M-3 0 l2 2 l4 -4"
              fill="none"
              stroke="#fff"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </G>
        </Svg>
      )}
      {kind === 'coin' && (
        <Svg width={44} height={44} viewBox="-22 -22 44 44">
          <Circle r={20} fill="#fde68a" stroke="#b45309" strokeWidth={1.5} />
          <Circle
            r={16}
            fill="none"
            stroke="#b45309"
            strokeOpacity={0.4}
            strokeWidth={1}
            strokeDasharray="2 2"
          />
          <SvgText
            y={6}
            textAnchor="middle"
            fontSize={18}
            fontWeight="800"
            fill="#fff"
            stroke="#b45309"
            strokeWidth={0.6}
          >
            $
          </SvgText>
        </Svg>
      )}
    </Animated.View>
  );
}
