import { useEffect } from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
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
  withRepeat,
  withSequence,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedCircle, AnimatedG, SceneProps } from './_shared';

// The central user avatar "cuts in" from the top-left of the scene.
const USER_ORIGIN = { x: 70, y: 60 };

const AGENTS = [
  { x: 210, y: 80, hue: '#2563eb', init: 'SJ', rating: '4.9' },
  { x: 290, y: 150, hue: '#16a34a', init: 'MC', rating: '4.8' },
  { x: 210, y: 225, hue: '#9333ea', init: 'EW', rating: '4.7' },
  { x: 115, y: 220, hue: '#0891b2', init: 'DK', rating: '4.9' },
] as const;

// Agents — user cuts in from top-left; four verified agents scatter across the rest,
// each connected back to the user with a dashed line and a pulsing ring.
export function SceneAgents({ playing }: SceneProps) {
  const ringR = useSharedValue(24);
  const ringOp = useSharedValue(0.8);
  const userScale = useSharedValue(1);

  useEffect(() => {
    if (!playing) return;
    ringR.value = 24;
    ringOp.value = 0.8;
    ringR.value = withRepeat(
      withTiming(54, { duration: 2200, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
    ringOp.value = withRepeat(
      withTiming(0, { duration: 2200, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
    userScale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    return () => {
      cancelAnimation(ringR);
      cancelAnimation(ringOp);
      cancelAnimation(userScale);
    };
  }, [playing, ringR, ringOp, userScale]);

  const ringProps = useAnimatedProps(() => ({
    r: ringR.value,
    opacity: ringOp.value,
  }));
  const userProps = useAnimatedProps(() => ({
    transform: `translate(${USER_ORIGIN.x} ${USER_ORIGIN.y}) scale(${userScale.value})`,
  }));

  return (
    <Svg viewBox="0 0 360 280" width="100%" height="100%">
      <Defs>
        <RadialGradient id="washAgents" cx="0.5" cy="0.5" r="0.6">
          <Stop offset="0%" stopColor="#dbeafe" stopOpacity="0.85" />
          <Stop offset="60%" stopColor="#eff6ff" stopOpacity="0.45" />
          <Stop offset="100%" stopColor="#eff6ff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="-40" y="-20" width="440" height="320" fill="url(#washAgents)" />

      {AGENTS.map((a, i) => (
        <Line
          key={`line-${i}`}
          x1={USER_ORIGIN.x}
          y1={USER_ORIGIN.y}
          x2={a.x}
          y2={a.y}
          stroke="#2563eb"
          strokeOpacity={0.2}
          strokeWidth={1.5}
          strokeDasharray="3 4"
        />
      ))}

      <AgentBadge index={0} playing={playing} />
      <AgentBadge index={1} playing={playing} />
      <AgentBadge index={2} playing={playing} />
      <AgentBadge index={3} playing={playing} />

      <AnimatedG animatedProps={userProps}>
        <Circle r="46" fill="#2563eb" opacity={0.1} />
        <Circle r="34" fill="#2563eb" opacity={0.2} />
        <Circle r="24" fill="#fff" stroke="#2563eb" strokeWidth={2} />
        <Circle cy="-4" r="7" fill="#2563eb" />
        <Path d="M-10 12 Q0 4 10 12 Z" fill="#2563eb" />
      </AnimatedG>

      <AnimatedCircle
        cx={USER_ORIGIN.x}
        cy={USER_ORIGIN.y}
        fill="none"
        stroke="#2563eb"
        strokeWidth={1.5}
        animatedProps={ringProps}
      />
    </Svg>
  );
}

function AgentBadge({
  index,
  playing,
}: Readonly<{ index: number; playing: boolean }>) {
  const a = AGENTS[index];
  const op = useSharedValue(0);
  const scale = useSharedValue(0.4);
  useEffect(() => {
    if (!playing) return;
    op.value = withDelay(200 + index * 150, withTiming(1, { duration: 500 }));
    scale.value = withDelay(
      200 + index * 150,
      withTiming(1, { duration: 500 }),
    );
    return () => {
      cancelAnimation(op);
      cancelAnimation(scale);
    };
  }, [playing, op, scale, index]);
  const props = useAnimatedProps(() => ({
    opacity: op.value,
    transform: `translate(${a.x} ${a.y}) scale(${scale.value})`,
  }));
  return (
    <AnimatedG animatedProps={props}>
      <Circle r="32" fill="#fff" opacity={0.7} />
      <Circle r="28" fill={a.hue} />
      <SvgText
        y="4"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="#fff"
      >
        {a.init}
      </SvgText>
      <G transform="translate(20 -18)">
        <Circle r="9" fill="#16a34a" stroke="#fff" strokeWidth={2} />
        <Path
          d="M-3.5 0 l2.5 2.5 l5 -5"
          fill="none"
          stroke="#fff"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
      <G transform="translate(0 42)">
        <Rect
          x="-22"
          y="-10"
          width="44"
          height="20"
          rx="10"
          fill="#fff"
          stroke="#e5e7eb"
        />
        <Path
          d="M-13 -3 L-11 0 L-8 0 L-10 2 L-9 5 L-13 3 L-17 5 L-16 2 L-18 0 L-15 0 Z"
          fill="#facc15"
        />
        <SvgText x="3" y="3" fontSize="10" fontWeight="700" fill="#111827">
          {a.rating}
        </SvgText>
      </G>
    </AnimatedG>
  );
}
