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
} from 'react-native-svg';
import {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedG, AnimatedPath, SceneProps } from './_shared';

// Documents — two paper cards slide in, rows of checklist items light up with checks.
export function SceneDocuments({ playing }: SceneProps) {
  return (
    <Svg viewBox="0 0 360 280" width="100%" height="100%">
      <Defs>
        <RadialGradient id="washDocs" cx="0.5" cy="0.5" r="0.55">
          <Stop offset="0%" stopColor="#dbeafe" stopOpacity="0.85" />
          <Stop offset="60%" stopColor="#eff6ff" stopOpacity="0.45" />
          <Stop offset="100%" stopColor="#eff6ff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="-40" y="-20" width="440" height="320" fill="url(#washDocs)" />

      <G transform="translate(180 150)">
        <PaperBack playing={playing} />
        <PaperFront playing={playing} />
        <CheckBadge playing={playing} />
      </G>
    </Svg>
  );
}

function PaperBack({ playing }: SceneProps) {
  const ty = useSharedValue(20);
  const op = useSharedValue(0);
  useEffect(() => {
    if (!playing) return;
    ty.value = withTiming(0, { duration: 1000 });
    op.value = withTiming(1, { duration: 1000 });
    return () => {
      cancelAnimation(ty);
      cancelAnimation(op);
    };
  }, [playing, ty, op]);
  const props = useAnimatedProps(() => ({
    transform: `translate(-90 ${-100 + ty.value}) rotate(-6)`,
    opacity: op.value,
  }));
  return (
    <AnimatedG animatedProps={props}>
      <Rect
        x="0"
        y="0"
        width="180"
        height="220"
        rx="12"
        fill="#fff"
        stroke="#e5e7eb"
      />
      <Rect x="18" y="22" width="80" height="10" rx="2" fill="#dbeafe" />
      <Rect x="18" y="42" width="120" height="6" rx="2" fill="#f3f4f6" />
      <Rect x="18" y="54" width="100" height="6" rx="2" fill="#f3f4f6" />
    </AnimatedG>
  );
}

function PaperFront({ playing }: SceneProps) {
  const ty = useSharedValue(30);
  const op = useSharedValue(0);
  useEffect(() => {
    if (!playing) return;
    ty.value = withDelay(200, withTiming(0, { duration: 1000 }));
    op.value = withDelay(200, withTiming(1, { duration: 1000 }));
    return () => {
      cancelAnimation(ty);
      cancelAnimation(op);
    };
  }, [playing, ty, op]);
  const props = useAnimatedProps(() => ({
    transform: `translate(-90 ${-110 + ty.value})`,
    opacity: op.value,
  }));
  return (
    <AnimatedG animatedProps={props}>
      <Rect
        x="0"
        y="0"
        width="180"
        height="220"
        rx="14"
        fill="#fff"
        stroke="#e5e7eb"
        strokeWidth={1.5}
      />
      <Rect x="18" y="18" width="10" height="10" rx="3" fill="#2563eb" />
      <Rect x="34" y="19" width="90" height="8" rx="2" fill="#111827" />
      <Rect x="18" y="36" width="60" height="5" rx="2" fill="#9ca3af" />
      <Line x1="18" y1="54" x2="162" y2="54" stroke="#f3f4f6" />
      <ChecklistRow index={0} playing={playing} rowWidth={90} subWidth={50} />
      <ChecklistRow index={1} playing={playing} rowWidth={70} subWidth={40} />
      <ChecklistRow index={2} playing={playing} rowWidth={100} subWidth={55} />
      <ChecklistRow index={3} playing={playing} rowWidth={80} subWidth={45} />
      <ChecklistRow index={4} playing={playing} rowWidth={95} subWidth={48} />
    </AnimatedG>
  );
}

function ChecklistRow({
  index,
  playing,
  rowWidth,
  subWidth,
}: Readonly<{
  index: number;
  playing: boolean;
  rowWidth: number;
  subWidth: number;
}>) {
  const op = useSharedValue(0);
  const dash = useSharedValue(14);
  const y = 70 + index * 28;

  useEffect(() => {
    if (!playing) return;
    op.value = withDelay(600 + index * 300, withTiming(1, { duration: 500 }));
    dash.value = withDelay(800 + index * 300, withTiming(0, { duration: 400 }));
    return () => {
      cancelAnimation(op);
      cancelAnimation(dash);
    };
  }, [playing, op, dash, index]);

  const groupProps = useAnimatedProps(() => ({ opacity: op.value }));
  const pathProps = useAnimatedProps(() => ({ strokeDashoffset: dash.value }));

  return (
    <AnimatedG animatedProps={groupProps}>
      <Rect
        x="18"
        y={y - 8}
        width="16"
        height="16"
        rx="4"
        fill="#dcfce7"
        stroke="#16a34a"
        strokeWidth={1.5}
      />
      <AnimatedPath
        d={`M22 ${y} l3 3 l6 -6`}
        fill="none"
        stroke="#16a34a"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="14"
        animatedProps={pathProps}
      />
      <Rect
        x="42"
        y={y - 4}
        width={rowWidth}
        height="6"
        rx="2"
        fill="#374151"
      />
      <Rect
        x="42"
        y={y + 5}
        width={subWidth}
        height="4"
        rx="2"
        fill="#d1d5db"
      />
    </AnimatedG>
  );
}

function CheckBadge({ playing }: SceneProps) {
  const op = useSharedValue(0);
  const scale = useSharedValue(0.3);
  useEffect(() => {
    if (!playing) return;
    op.value = withDelay(2400, withTiming(1, { duration: 300 }));
    scale.value = withDelay(
      2400,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.6)) }),
    );
    return () => {
      cancelAnimation(op);
      cancelAnimation(scale);
    };
  }, [playing, op, scale]);
  const props = useAnimatedProps(() => ({
    opacity: op.value,
    transform: `translate(80 90) scale(${scale.value})`,
  }));
  return (
    <AnimatedG animatedProps={props}>
      <Circle r="22" fill="#16a34a" />
      <Circle
        r="22"
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
    </AnimatedG>
  );
}
