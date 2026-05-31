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
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedG, AnimatedRect, SceneProps } from './_shared';

// Track — a phone mock shows a progress bar filling, a vertical timeline growing,
// step nodes filling, an APPROVED status, and a sliding push notification.
export function SceneTrack({ playing }: SceneProps) {
  const progressW = useSharedValue(0);
  const lineH = useSharedValue(0);
  const statusOp = useSharedValue(0);
  const notifOp = useSharedValue(0);
  const notifX = useSharedValue(-20);

  useEffect(() => {
    if (!playing) return;
    progressW.value = withDelay(400, withTiming(102, { duration: 2500 }));
    lineH.value = withDelay(400, withTiming(96, { duration: 2500 }));
    statusOp.value = withDelay(2800, withTiming(1, { duration: 400 }));
    notifOp.value = withDelay(1800, withTiming(1, { duration: 600 }));
    notifX.value = withDelay(1800, withTiming(0, { duration: 600 }));
    return () => {
      cancelAnimation(progressW);
      cancelAnimation(lineH);
      cancelAnimation(statusOp);
      cancelAnimation(notifOp);
      cancelAnimation(notifX);
    };
  }, [playing, progressW, lineH, statusOp, notifOp, notifX]);

  const progressProps = useAnimatedProps(() => ({ width: progressW.value }));
  const lineProps = useAnimatedProps(() => ({ height: lineH.value }));
  const statusProps = useAnimatedProps(() => ({ opacity: statusOp.value }));
  const notifProps = useAnimatedProps(() => ({
    opacity: notifOp.value,
    transform: `translate(${68 + notifX.value} 110)`,
  }));

  return (
    <Svg viewBox="0 0 360 280" width="100%" height="100%">
      <Defs>
        <RadialGradient id="washTrack" cx="0.5" cy="0.5" r="0.6">
          <Stop offset="0%" stopColor="#dbeafe" stopOpacity="0.85" />
          <Stop offset="60%" stopColor="#eff6ff" stopOpacity="0.45" />
          <Stop offset="100%" stopColor="#eff6ff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="-40" y="-20" width="440" height="320" fill="url(#washTrack)" />

      <G transform="translate(115 52)">
        <Rect
          x="0"
          y="0"
          width="130"
          height="196"
          rx="18"
          fill="#fff"
          stroke="#e5e7eb"
          strokeWidth={1.5}
        />
        <Rect x="54" y="7" width="22" height="5" rx="2.5" fill="#030712" />

        <Rect x="14" y="22" width="46" height="7" rx="2" fill="#111827" />
        <Rect x="14" y="34" width="70" height="5" rx="2" fill="#9ca3af" />

        <Rect x="14" y="50" width="102" height="6" rx="3" fill="#f3f4f6" />
        <AnimatedRect
          x="14"
          y="50"
          height="6"
          rx="3"
          fill="#2563eb"
          animatedProps={progressProps}
        />

        <Line
          x1="25"
          y1="72"
          x2="25"
          y2="170"
          stroke="#e5e7eb"
          strokeWidth={2}
        />
        <AnimatedRect
          x="24"
          y="72"
          width="2"
          fill="#2563eb"
          animatedProps={lineProps}
        />

        <TimelineStep index={0} playing={playing} />
        <TimelineStep index={1} playing={playing} />
        <TimelineStep index={2} playing={playing} />
        <TimelineStep index={3} playing={playing} />

        <AnimatedRect
          x="14"
          y="176"
          width="102"
          height="14"
          rx="7"
          fill="#dcfce7"
          animatedProps={statusProps}
        />
        <SvgText
          x="65"
          y="186"
          textAnchor="middle"
          fontSize="7"
          fontWeight="700"
          fill="#166534"
        >
          APPROVED
        </SvgText>
      </G>

      <AnimatedG animatedProps={notifProps}>
        <Rect
          x="-8"
          y="-18"
          width="120"
          height="36"
          rx="10"
          fill="#fff"
          stroke="#e5e7eb"
        />
        <Circle cx="4" cy="0" r="8" fill="#2563eb" />
        <Path
          d="M1 0 l2 2 l4.5 -4.5"
          fill="none"
          stroke="#fff"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Rect x="18" y="-6" width="80" height="4" rx="2" fill="#111827" />
        <Rect x="18" y="2" width="60" height="3" rx="2" fill="#9ca3af" />
      </AnimatedG>
    </Svg>
  );
}

function TimelineStep({
  index,
  playing,
}: Readonly<{ index: number; playing: boolean }>) {
  const op = useSharedValue(0);
  const scale = useSharedValue(0.4);
  const isLast = index === 3;
  const y = 72 + index * 32;
  const delay = 500 + index * 600;

  useEffect(() => {
    if (!playing) return;
    op.value = withDelay(delay, withTiming(1, { duration: 300 }));
    scale.value = withDelay(delay, withTiming(1, { duration: 300 }));
    return () => {
      cancelAnimation(op);
      cancelAnimation(scale);
    };
  }, [playing, op, scale, delay]);

  const props = useAnimatedProps(() => ({
    opacity: op.value,
    transform: `translate(25 ${y}) scale(${scale.value})`,
  }));

  return (
    <G>
      <Circle
        cx="25"
        cy={y}
        r="6"
        fill="#fff"
        stroke="#d1d5db"
        strokeWidth={2}
      />
      <AnimatedG animatedProps={props}>
        <Circle r="6" fill={isLast ? '#facc15' : '#2563eb'} />
        <Path
          d="M-3 0 l2 2 l4.5 -4.5"
          fill="none"
          stroke="#fff"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </AnimatedG>
      <Rect
        x="38"
        y={y - 4}
        width="70"
        height="5"
        rx="2"
        fill={isLast ? '#9ca3af' : '#374151'}
      />
      <Rect x="38" y={y + 4} width="45" height="3.5" rx="2" fill="#d1d5db" />
    </G>
  );
}
