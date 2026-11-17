// ─────────────────────────────────────────────────────────────────────────────
// GlassButton (japa#146 review note 4): only a GlassButton with an `onPress`
// is announced as a button and fades on press. A decorative one (no handler,
// e.g. the agency screen's arrow) stays exactly as before: no role, no state.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('react-native-reanimated', () =>
  jest.requireActual('react-native-reanimated/mock'),
);
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/lib/module/mock'),
);
jest.mock('expo-blur', () => ({
  BlurView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));

import React from 'react';
import { StyleSheet } from 'react-native';
import { describe, expect, it, jest } from '@jest/globals';
import TestRenderer, { act } from 'react-test-renderer';
import { GlassButton } from '../primitives';
import { Ic } from '../icons';

/**
 * The Pressable PressableStatic renders (found by its props: the css-interop
 * build wraps the Pressable type, so findByType does not see it).
 */
function findPressable(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAll(
    (n) => n.props.hitSlop === 6 && typeof n.props.onPressIn === 'function',
  )[0];
}

/** Render and return the inner Pressable. */
function pressable(el: React.ReactElement) {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return { tree, node: findPressable(tree) };
}

describe('GlassButton', () => {
  it('no onPress: no button role, no state, no press fade', () => {
    const { node } = pressable(<GlassButton icon={Ic.arrowUR} />);
    expect(node.props.accessibilityRole).toBeUndefined();
    expect(node.props.accessibilityState).toBeUndefined();
    act(() => node.props.onPressIn?.({}));
    expect(StyleSheet.flatten(node.props.style)?.opacity).toBe(1);
  });

  it('with onPress: a button that fades to 0.7 while pressed', () => {
    const { tree } = pressable(
      <GlassButton
        icon={Ic.chevL}
        onPress={() => {}}
        accessibilityLabel="Back"
      />,
    );
    const node = () => findPressable(tree);
    expect(node().props.accessibilityRole).toBe('button');
    expect(node().props.accessibilityLabel).toBe('Back');
    act(() => node().props.onPressIn?.({}));
    expect(StyleSheet.flatten(node().props.style)?.opacity).toBe(0.7);
  });
});
