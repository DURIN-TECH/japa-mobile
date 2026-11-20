// ─────────────────────────────────────────────────────────────────────────────
// japa#420: the "Add a document" sheet. It shows Photo library, Take a photo
// and Files in that order plus Cancel; a row tap calls back with its source
// once the sheet has closed (and only once, even on a double tap); every way
// of closing without a choice calls `onClose` and nothing else. Also the
// InlineError "Open Settings" action the camera-denied line uses.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('react-native-reanimated', () =>
  jest.requireActual('react-native-reanimated/mock'),
);
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/lib/module/mock'),
);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// RNGH: the detector and root just render their children; the pan builder
// is chainable and inert (the drag itself is checked on the device).
jest.mock('react-native-gesture-handler', () => {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const k of [
    'runOnJS',
    'activeOffsetY',
    'onUpdate',
    'onFinalize',
    'onStart',
  ])
    chain[k] = self;
  return {
    Gesture: { Pan: () => chain },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) =>
      children,
  };
});

import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { UPLOAD_SOURCE_COPY, UploadSourceSheet } from '../UploadSourceSheet';
import { InlineError } from '../AccountForm';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** The pressable with this testID (the host node that carries onPress). */
function byTestId(tree: TestRenderer.ReactTestRenderer, id: string) {
  return tree.root.findAll(
    (n) => n.props.testID === id && typeof n.props.onPress === 'function',
  )[0];
}

/** Render the sheet open and let its open animation settle. */
async function renderOpen() {
  const onChoose = jest.fn();
  const onClose = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <UploadSourceSheet visible onChoose={onChoose} onClose={onClose} />,
    );
  });
  return { tree, onChoose, onClose };
}

describe('UploadSourceSheet', () => {
  it('shows the title, the three sources in order, the Files hint and Cancel', async () => {
    const { tree } = await renderOpen();
    const texts = tree.root
      .findAllByType(Text)
      .map((t) => t.props.children)
      .filter((c) => typeof c === 'string');
    expect(texts).toEqual([
      UPLOAD_SOURCE_COPY.title,
      'Photo library',
      'Take a photo',
      'Files',
      'PDF, JPEG or PNG',
      'Cancel',
    ]);
    // The e2e hooks (Maestro, japa#361).
    for (const id of ['library', 'camera', 'files', 'cancel'])
      expect(byTestId(tree, `uploadSourceSheet.${id}`)).toBeTruthy();
  });

  it.each(['library', 'camera', 'files'] as const)(
    'a %s tap calls back with that source once the sheet has gone',
    async (source) => {
      jest.useFakeTimers();
      const { tree, onChoose, onClose } = await renderOpen();
      const row = byTestId(tree, `uploadSourceSheet.${source}`);
      act(() => row.props.onPress());
      // A second tap while closing is ignored (no double pick).
      act(() => row.props.onPress());
      // Nothing yet: the picker must wait for the sheet to close.
      expect(onChoose).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(onChoose).toHaveBeenCalledTimes(1);
      expect(onChoose).toHaveBeenCalledWith(source);
      expect(onClose).not.toHaveBeenCalled();
      jest.useRealTimers();
    },
  );

  it('Cancel and the backdrop close without choosing', async () => {
    jest.useFakeTimers();
    for (const find of [
      (t: TestRenderer.ReactTestRenderer) =>
        byTestId(t, 'uploadSourceSheet.cancel'),
      (t: TestRenderer.ReactTestRenderer) =>
        t.root.findAll(
          (n) =>
            n.props.accessibilityLabel === UPLOAD_SOURCE_COPY.closeLabel &&
            typeof n.props.onPress === 'function',
        )[0],
    ]) {
      const { tree, onChoose, onClose } = await renderOpen();
      act(() => find(tree).props.onPress());
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onChoose).not.toHaveBeenCalled();
    }
    jest.useRealTimers();
  });
});

describe('InlineError action', () => {
  it('renders the action as a button and calls it', () => {
    const onPress = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <InlineError
          message="Seli can’t use your camera. Turn it on in Settings."
          action={{ label: 'Open Settings', onPress }}
        />,
      );
    });
    const btn = byTestId(tree, 'inlineError.action');
    expect(btn.props.accessibilityRole).toBe('button');
    expect(btn.props.accessibilityLabel).toBe('Open Settings');
    act(() => btn.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('without an action there is no button', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<InlineError message="Something" />);
    });
    expect(byTestId(tree, 'inlineError.action')).toBeUndefined();
  });
});
