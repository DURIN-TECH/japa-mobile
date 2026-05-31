import { useEffect } from 'react';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
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
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedG, AnimatedPath, SceneProps } from './_shared';

// Discover — globe with dashed orbit, animated route, passport stamps, and an orbiting satellite.
export function SceneDiscover({ playing }: SceneProps) {
  const spin = useSharedValue(0);
  const globeSpin = useSharedValue(0);
  const routeDash = useSharedValue(200);
  const floaty1 = useSharedValue(0);
  const floaty2 = useSharedValue(0);
  const satOrbit = useSharedValue(0);
  const satBob = useSharedValue(0);

  useEffect(() => {
    if (!playing) return;
    spin.value = withRepeat(
      withTiming(360, { duration: 30000, easing: Easing.linear }),
      -1,
    );
    globeSpin.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1,
    );
    routeDash.value = withDelay(200, withTiming(0, { duration: 1600 }));
    floaty1.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    floaty2.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      ),
    );
    satOrbit.value = withRepeat(
      withTiming(360, { duration: 9000, easing: Easing.linear }),
      -1,
    );
    satBob.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(3, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    return () => {
      cancelAnimation(spin);
      cancelAnimation(globeSpin);
      cancelAnimation(routeDash);
      cancelAnimation(floaty1);
      cancelAnimation(floaty2);
      cancelAnimation(satOrbit);
      cancelAnimation(satBob);
    };
  }, [playing, spin, globeSpin, routeDash, floaty1, floaty2, satOrbit, satBob]);

  // Satellite rides an elliptical orbit around the globe (180, 150),
  // staying upright via translate-only (plus a subtle vertical bob on top).
  const satX = useDerivedValue(
    () => 180 + 118 * Math.cos((satOrbit.value * Math.PI) / 180),
  );
  const satY = useDerivedValue(
    () => 150 + 40 * Math.sin((satOrbit.value * Math.PI) / 180) + satBob.value,
  );
  const satelliteProps = useAnimatedProps(() => ({
    translateX: satX.value,
    translateY: satY.value,
  }));
  const satSignalProps = useAnimatedProps(() => ({
    opacity: 0.35 + 0.35 * Math.abs(Math.sin((satOrbit.value * Math.PI) / 90)),
  }));

  const orbitProps = useAnimatedProps(() => ({
    originX: 180,
    originY: 150,
    rotation: spin.value,
  }));
  const globeProps = useAnimatedProps(() => ({
    originX: 180,
    originY: 150,
    rotation: globeSpin.value,
  }));
  const routeProps = useAnimatedProps(() => ({
    strokeDashoffset: routeDash.value,
  }));
  const stamp1Props = useAnimatedProps(() => ({
    translateX: 72,
    translateY: 70 + floaty1.value,
    rotation: -14,
  }));
  const stamp2Props = useAnimatedProps(() => ({
    translateX: 290,
    translateY: 215 + floaty2.value,
    rotation: 12,
  }));

  return (
    <Svg viewBox="0 0 360 280" width="100%" height="100%">
      <Defs>
        <ClipPath id="globeClip">
          <Circle cx="180" cy="150" r="96" />
        </ClipPath>
        <RadialGradient id="globeSheen" cx="0.35" cy="0.3" r="0.8">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <Stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="washDiscover" cx="0.5" cy="0.5" r="0.55">
          <Stop offset="0%" stopColor="#dbeafe" stopOpacity="0.9" />
          <Stop offset="60%" stopColor="#eff6ff" stopOpacity="0.5" />
          <Stop offset="100%" stopColor="#eff6ff" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect
        x="-40"
        y="-20"
        width="440"
        height="320"
        fill="url(#washDiscover)"
      />

      <AnimatedG animatedProps={orbitProps}>
        <Ellipse
          cx="180"
          cy="150"
          rx="128"
          ry="38"
          fill="none"
          stroke="#2563eb"
          strokeOpacity={0.25}
          strokeWidth={1.5}
          strokeDasharray="3 6"
        />
      </AnimatedG>

      <Circle cx="180" cy="150" r="96" fill="#2563eb" />
      <AnimatedG clipPath="url(#globeClip)" animatedProps={globeProps}>
        <Path
          d="M110 120 Q130 100 155 110 Q175 120 170 140 Q160 155 140 150 Q115 145 110 120Z"
          fill="#1d4ed8"
        />
        <Path
          d="M180 95 Q210 90 220 115 Q225 130 210 135 Q195 130 185 115 Q180 105 180 95Z"
          fill="#1d4ed8"
        />
        <Path
          d="M200 160 Q235 155 245 180 Q240 210 215 215 Q195 205 195 180 Q195 165 200 160Z"
          fill="#1d4ed8"
        />
        <Path
          d="M115 180 Q140 175 155 195 Q150 215 130 218 Q110 210 115 180Z"
          fill="#1d4ed8"
        />
        <Ellipse
          cx="180"
          cy="150"
          rx="96"
          ry="40"
          fill="none"
          stroke="#60a5fa"
          strokeOpacity={0.5}
          strokeWidth={1}
        />
        <Ellipse
          cx="180"
          cy="150"
          rx="60"
          ry="96"
          fill="none"
          stroke="#60a5fa"
          strokeOpacity={0.5}
          strokeWidth={1}
        />
        <Ellipse
          cx="180"
          cy="150"
          rx="30"
          ry="96"
          fill="none"
          stroke="#60a5fa"
          strokeOpacity={0.4}
          strokeWidth={1}
        />
        <Line
          x1="84"
          y1="150"
          x2="276"
          y2="150"
          stroke="#60a5fa"
          strokeOpacity={0.5}
          strokeWidth={1}
        />
      </AnimatedG>
      <Circle cx="180" cy="150" r="96" fill="url(#globeSheen)" />

      <Circle cx="130" cy="115" r="5" fill="#fff" />
      <Circle cx="130" cy="115" r="2.5" fill="#2563eb" />
      <Circle cx="232" cy="182" r="5" fill="#fff" />
      <Circle cx="232" cy="182" r="2.5" fill="#2563eb" />

      <AnimatedPath
        d="M130 115 Q180 60 232 182"
        fill="none"
        stroke="#fff"
        strokeWidth={2}
        strokeDasharray="4 5"
        animatedProps={routeProps}
      />

      <AnimatedG animatedProps={stamp1Props}>
        <Rect
          x="-22"
          y="-16"
          width="44"
          height="32"
          rx="3"
          fill="none"
          stroke="#16a34a"
          strokeWidth={2}
          strokeDasharray="2 2"
          opacity={0.85}
        />
        <SvgText
          x="0"
          y="1"
          textAnchor="middle"
          fontSize="7"
          fontWeight="700"
          fill="#16a34a"
        >
          APPROVED
        </SvgText>
        <SvgText
          x="0"
          y="10"
          textAnchor="middle"
          fontSize="5"
          fill="#16a34a"
          opacity={0.8}
        >
          USA · 2026
        </SvgText>
      </AnimatedG>
      <AnimatedG animatedProps={stamp2Props}>
        <Rect
          x="-22"
          y="-14"
          width="44"
          height="28"
          rx="3"
          fill="none"
          stroke="#2563eb"
          strokeWidth={2}
          strokeDasharray="2 2"
          opacity={0.9}
        />
        <SvgText
          x="0"
          y="1"
          textAnchor="middle"
          fontSize="7"
          fontWeight="700"
          fill="#2563eb"
        >
          VISA
        </SvgText>
        <SvgText
          x="0"
          y="9"
          textAnchor="middle"
          fontSize="5"
          fill="#2563eb"
          opacity={0.8}
        >
          SCHENGEN
        </SvgText>
      </AnimatedG>

      {/* Satellite orbiting the globe */}
      <AnimatedG animatedProps={satelliteProps}>
        {/* signal blips towards globe */}
        <AnimatedG animatedProps={satSignalProps}>
          <Circle cx="-10" cy="4" r="1.6" fill="#2563eb" />
          <Circle cx="-16" cy="8" r="1.2" fill="#2563eb" opacity={0.8} />
          <Circle cx="-22" cy="12" r="0.9" fill="#2563eb" opacity={0.6} />
        </AnimatedG>
        {/* left solar panel */}
        <Rect
          x="-22"
          y="-4"
          width="12"
          height="8"
          rx="1"
          fill="#3b82f6"
          stroke="#1e40af"
          strokeWidth={0.6}
        />
        <Line
          x1="-16"
          y1="-4"
          x2="-16"
          y2="4"
          stroke="#1e40af"
          strokeOpacity={0.5}
          strokeWidth={0.4}
        />
        {/* right solar panel */}
        <Rect
          x="10"
          y="-4"
          width="12"
          height="8"
          rx="1"
          fill="#3b82f6"
          stroke="#1e40af"
          strokeWidth={0.6}
        />
        <Line
          x1="16"
          y1="-4"
          x2="16"
          y2="4"
          stroke="#1e40af"
          strokeOpacity={0.5}
          strokeWidth={0.4}
        />
        {/* body */}
        <Rect
          x="-10"
          y="-6"
          width="20"
          height="12"
          rx="2"
          fill="#e2e8f0"
          stroke="#64748b"
          strokeWidth={0.8}
        />
        <Rect x="-7" y="-3" width="14" height="3" rx="0.5" fill="#94a3b8" />
        {/* antenna */}
        <Line
          x1="0"
          y1="-6"
          x2="0"
          y2="-13"
          stroke="#64748b"
          strokeWidth={0.8}
        />
        <Circle cx="0" cy="-14" r="1.6" fill="#ef4444" />
      </AnimatedG>
    </Svg>
  );
}
