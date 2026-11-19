// ─────────────────────────────────────────────────────────────────────────────
// PressableStatic (japa#174) — a Pressable that never hands React Native a
// function-style `style`.
//
// WHY: in this build (NativeWind css-interop) `style={({ pressed }) => …}` on a
// Pressable renders UNSTYLED (a white label on a white card, no button fill).
// This wrapper tracks `pressed` itself (onPressIn / onPressOut) and resolves the
// style function to a plain value before it reaches Pressable, so call sites
// can keep writing `style={({ pressed }) => …}` or a plain style.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = Omit<PressableProps, 'style'> & {
  style?:
    | StyleProp<ViewStyle>
    | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
};

export function PressableStatic({
  style,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Props) {
  const [pressed, setPressed] = useState(false);
  const resolved = typeof style === 'function' ? style({ pressed }) : style;
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={resolved}
    >
      {children as React.ReactNode}
    </Pressable>
  );
}
