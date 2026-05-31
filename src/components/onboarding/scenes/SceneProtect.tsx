import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedCircle, AnimatedG, SceneProps } from './_shared';

type Coin = {
  sym: string;
  top: string;
  bot: string;
  ring: string;
  label: string;
  x: number;
  y: number;
  delay: number;
  rot: number;
};

// Hex ring around bottom-svg center (PROTECT_CENTER), radius 210 — roomy enough
// to fit six r=100 coins (adjacent centers 210 apart, coin diameter 200, 10-unit gap).
const COINS: readonly Coin[] = [
  {
    sym: '$',
    top: '#fde68a',
    bot: '#f59e0b',
    ring: '#b45309',
    label: 'USD',
    x: -182,
    y: -105,
    delay: 400,
    rot: -8,
  },
  {
    sym: '€',
    top: '#bfdbfe',
    bot: '#3b82f6',
    ring: '#1e40af',
    label: 'EUR',
    x: 0,
    y: -210,
    delay: 550,
    rot: 6,
  },
  {
    sym: '£',
    top: '#fecaca',
    bot: '#ef4444',
    ring: '#991b1b',
    label: 'GBP',
    x: 182,
    y: -105,
    delay: 700,
    rot: -4,
  },
  {
    sym: '¥',
    top: '#fbcfe8',
    bot: '#ec4899',
    ring: '#9d174d',
    label: 'JPY',
    x: 182,
    y: 105,
    delay: 850,
    rot: 6,
  },
  {
    sym: '₦',
    top: '#c7d2fe',
    bot: '#6366f1',
    ring: '#3730a3',
    label: 'NGN',
    x: 0,
    y: 210,
    delay: 1000,
    rot: -6,
  },
  {
    sym: '₹',
    top: '#d9f99d',
    bot: '#65a30d',
    ring: '#3f6212',
    label: 'INR',
    x: -182,
    y: 105,
    delay: 1150,
    rot: 10,
  },
];

// Center of the bottom viewBox (where the coin ring + lock sit).
const PROTECT_CENTER = { x: 180, y: 240 };

// Protect — two stacked viewBoxes:
//   Upper: an ESCROW header pill above a shield that cuts in from the top-left.
//   Lower: six currency coins ringed around a central padlock, with ripple pulses.
export function SceneProtect({ playing }: Readonly<SceneProps>) {
  const shieldOp = useSharedValue(0);
  const shieldScale = useSharedValue(0.5);
  const escrowOp = useSharedValue(0);
  const lockOp = useSharedValue(0);
  const lockScale = useSharedValue(0.2);

  useEffect(() => {
    if (!playing) return;
    shieldOp.value = withDelay(100, withTiming(1, { duration: 900 }));
    shieldScale.value = withDelay(
      100,
      withTiming(1, { duration: 900, easing: Easing.out(Easing.back(1.2)) }),
    );
    escrowOp.value = withDelay(1000, withTiming(1, { duration: 400 }));
    lockOp.value = withDelay(1800, withTiming(1, { duration: 550 }));
    lockScale.value = withDelay(
      1800,
      withTiming(1, { duration: 550, easing: Easing.out(Easing.back(1.6)) }),
    );
    return () => {
      cancelAnimation(shieldOp);
      cancelAnimation(shieldScale);
      cancelAnimation(escrowOp);
      cancelAnimation(lockOp);
      cancelAnimation(lockScale);
    };
  }, [playing, shieldOp, shieldScale, escrowOp, lockOp, lockScale]);

  const shieldProps = useAnimatedProps(() => ({
    opacity: shieldOp.value,
    transform: `translate(60 130) scale(${shieldScale.value})`,
  }));
  const escrowProps = useAnimatedProps(() => ({ opacity: escrowOp.value }));
  const lockProps = useAnimatedProps(() => ({
    opacity: lockOp.value,
    transform: `translate(${PROTECT_CENTER.x} ${PROTECT_CENTER.y}) scale(${lockScale.value})`,
  }));

  return (
    <View style={{ flex: 1, width: '100%' }}>
      {/* ── Upper viewBox: ESCROW pill stacked ABOVE the shield ───── */}
      <View style={{ width: '100%', height: 220 }}>
        <Svg
          viewBox="0 0 360 220"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          <Defs>
            <LinearGradient id="shieldSheen" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
              <Stop offset="60%" stopColor="#fff" stopOpacity="0" />
            </LinearGradient>
            <RadialGradient id="washProtectTop" cx="0.5" cy="0.5" r="0.6">
              <Stop offset="0%" stopColor="#dbeafe" stopOpacity="0.85" />
              <Stop offset="60%" stopColor="#eff6ff" stopOpacity="0.45" />
              <Stop offset="100%" stopColor="#eff6ff" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect
            x="-40"
            y="-20"
            width="440"
            height="280"
            fill="url(#washProtectTop)"
          />

          {/* ESCROW header pill — sits above the shield */}
          <AnimatedG animatedProps={escrowProps}>
            <G transform="translate(90 90)">
              <Rect
                x="-52"
                y="-16"
                width="104"
                height="32"
                rx="16"
                fill="#2563eb"
                stroke="#1e40af"
                strokeWidth={1.5}
              />
              <G transform="translate(-37 0)">
                <Rect
                  x="-5"
                  y="-3"
                  width="10"
                  height="9"
                  rx="1.5"
                  fill="#fff"
                />
                <Path
                  d="M-3 -3 v-3 a3 3 0 0 1 6 0 v3"
                  fill="none"
                  stroke="#fff"
                  strokeWidth={1.6}
                />
              </G>
              <SvgText
                x="-27"
                y="5"
                fontSize="14"
                fontWeight="700"
                fill="#fff"
                letterSpacing="2"
              >
                ESCROW
              </SvgText>
            </G>
          </AnimatedG>

          {/* Shield cuts in from the top-left below the escrow pill */}
          <AnimatedG animatedProps={shieldProps}>
            <Path
              d="M0 -88 C 0 -88 44 -74 74 -62 C 74 -14 62 48 0 84 C -62 48 -74 -14 -74 -62 C -44 -74 0 -88 0 -88 Z"
              fill="#2563eb"
              stroke="#1e40af"
              strokeWidth={2}
            />
            <Path
              d="M0 -88 C 0 -88 44 -74 74 -62 C 74 -14 62 48 0 84 C -62 48 -74 -14 -74 -62 C -44 -74 0 -88 0 -88 Z"
              fill="url(#shieldSheen)"
            />
            <Path
              d="M0 -76 C 0 -76 38 -64 64 -54 C 64 -12 54 40 0 72 C -54 40 -64 -12 -64 -54 C -38 -64 0 -76 0 -76 Z"
              fill="none"
              stroke="#fff"
              strokeOpacity={0.3}
              strokeWidth={1.2}
            />
          </AnimatedG>
        </Svg>
      </View>

      {/* ── Lower viewBox: coin ring encircling the central lock ──── */}
      <View style={{ flex: 1, width: '100%', overflow: 'visible' }}>
        <Svg
          viewBox="-40 0 440 540"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          <Defs>
            <RadialGradient id="washProtectBot" cx="0.5" cy="0.5" r="0.6">
              <Stop offset="0%" stopColor="#dbeafe" stopOpacity="0.85" />
              <Stop offset="60%" stopColor="#eff6ff" stopOpacity="0.45" />
              <Stop offset="100%" stopColor="#eff6ff" stopOpacity="0" />
            </RadialGradient>
            {COINS.map((c) => (
              <RadialGradient
                key={c.label}
                id={`coinG${c.label}`}
                cx="0.35"
                cy="0.3"
                r="0.9"
              >
                <Stop offset="0%" stopColor={c.top} />
                <Stop offset="100%" stopColor={c.bot} />
              </RadialGradient>
            ))}
          </Defs>

          <Rect
            x="-80"
            y="-40"
            width="520"
            height="600"
            fill="url(#washProtectBot)"
          />

          <Ripple index={0} playing={playing} />
          <Ripple index={1} playing={playing} />
          <Ripple index={2} playing={playing} />

          <CoinBadge index={0} playing={playing} />
          <CoinBadge index={1} playing={playing} />
          <CoinBadge index={2} playing={playing} />
          <CoinBadge index={3} playing={playing} />
          <CoinBadge index={4} playing={playing} />
          <CoinBadge index={5} playing={playing} />

          <AnimatedG animatedProps={lockProps}>
            <Circle r="66" fill="#fff" />
            <Circle
              r="66"
              fill="none"
              stroke="#2563eb"
              strokeOpacity={0.25}
              strokeWidth={3}
            />
            <Rect x="-21" y="-6" width="42" height="36" rx="7" fill="#2563eb" />
            <Path
              d="M-13.5 -6 v-12 a13.5 13.5 0 0 1 27 0 v12"
              fill="none"
              stroke="#2563eb"
              strokeWidth={6}
            />
            <Circle cx="0" cy="12" r="4.5" fill="#fff" />
          </AnimatedG>
        </Svg>
      </View>
    </View>
  );
}

function Ripple({
  index,
  playing,
}: Readonly<{ index: number; playing: boolean }>) {
  const r = useSharedValue(80);
  const op = useSharedValue(0.5);
  const delay = index * 700;

  useEffect(() => {
    if (!playing) return;
    r.value = 80;
    op.value = 0.5;
    r.value = withDelay(
      delay,
      withRepeat(
        withTiming(220, { duration: 2400, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
    op.value = withDelay(
      delay,
      withRepeat(
        withTiming(0, { duration: 2400, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
    return () => {
      cancelAnimation(r);
      cancelAnimation(op);
    };
  }, [playing, r, op, delay]);

  const props = useAnimatedProps(() => ({ r: r.value, opacity: op.value }));
  return (
    <AnimatedCircle
      cx={PROTECT_CENTER.x}
      cy={PROTECT_CENTER.y}
      fill="none"
      stroke="#2563eb"
      strokeOpacity={0.35}
      strokeWidth={2}
      animatedProps={props}
    />
  );
}

// Peak vertical travel of the bounce (SVG units). Scaled to phone pixels this
// is ~25-30px — subtle but clearly visible.
const BOB_AMPLITUDE = 32;

function CoinBadge({
  index,
  playing,
}: Readonly<{ index: number; playing: boolean }>) {
  const coin = COINS[index];
  const op = useSharedValue(0);
  const scale = useSharedValue(0.2);
  // Continuous up/down bob applied to the coin body after entrance.
  // Shadow stays on the ground; label pill stays fixed.
  const bob = useSharedValue(0);

  useEffect(() => {
    if (!playing) return;
    op.value = withDelay(coin.delay, withTiming(1, { duration: 600 }));
    scale.value = withDelay(
      coin.delay,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.6)) }),
    );
    // Stagger bounces so coins don't all rise/fall together.
    bob.value = withDelay(
      coin.delay + 700,
      withRepeat(
        withSequence(
          withTiming(-BOB_AMPLITUDE, {
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0, {
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
      ),
    );
    return () => {
      cancelAnimation(op);
      cancelAnimation(scale);
      cancelAnimation(bob);
    };
  }, [playing, op, scale, bob, coin.delay]);

  // Absolute anchor of this coin in the bottom viewBox.
  const anchorX = PROTECT_CENTER.x + coin.x;
  const anchorY = PROTECT_CENTER.y + coin.y;

  // All three groups below share the SAME parent (the <Svg>), so nested
  // animated transforms don't interfere. Each one composes its own transform
  // in one go: position + entrance scale (+ rotate or bob as needed).

  // Ground shadow — fixed at anchor, fades + horizontally scales as the coin lifts.
  const shadowProps = useAnimatedProps(() => {
    const lift = Math.abs(bob.value) / BOB_AMPLITUDE; // 0 at rest → 1 at peak
    return {
      opacity: op.value * (0.22 - 0.12 * lift),
      transform: `translate(${anchorX} ${anchorY}) scale(${
        scale.value * (1 - 0.3 * lift)
      } ${scale.value})`,
    };
  });

  // Coin body + inner ring + symbol — bounces.
  const bodyProps = useAnimatedProps(() => ({
    opacity: op.value,
    transform: `translate(${anchorX} ${anchorY + bob.value}) scale(${
      scale.value
    }) rotate(${coin.rot})`,
  }));

  // Label pill — grounded at anchor.
  const labelProps = useAnimatedProps(() => ({
    opacity: op.value,
    transform: `translate(${anchorX} ${anchorY}) scale(${scale.value})`,
  }));

  return (
    <>
      {/* Ground shadow */}
      <AnimatedG animatedProps={shadowProps}>
        <Ellipse
          cx="0"
          cy="230"
          rx="140"
          ry="22"
          fill="#1e3a8a"
          fillOpacity={1}
        />
      </AnimatedG>

      {/* Bouncing coin body */}
      <AnimatedG animatedProps={bodyProps}>
        <Circle
          r="200"
          fill={`url(#coinG${coin.label})`}
          stroke={coin.ring}
          strokeWidth={20}
        />
        <Circle
          r="152"
          fill="none"
          stroke={coin.ring}
          strokeOpacity={0.85}
          strokeWidth={8}
          strokeDasharray="16 32"
          strokeLinecap="round"
        />
        <SvgText
          y="68"
          textAnchor="middle"
          fontSize="190"
          fontWeight="900"
          fill="#fff"
          stroke={coin.ring}
          strokeWidth={2}
        >
          {coin.sym}
        </SvgText>
      </AnimatedG>

      {/* Label pill — grounded, not bouncing */}
      <AnimatedG animatedProps={labelProps}>
        <G transform="translate(10 290)">
          <Rect
            x="-126"
            y="-10"
            width="252"
            height="140"
            rx="20"
            fill="#fff"
            stroke="#e5e7eb"
            strokeWidth={1.5}
          />
          <SvgText
            y="90"
            textAnchor="middle"
            fontSize="86"
            fontWeight="700"
            fill="#111827"
            letterSpacing="1.5"
          >
            {coin.label}
          </SvgText>
        </G>
      </AnimatedG>
    </>
  );
}
