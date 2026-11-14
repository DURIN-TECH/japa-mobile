// ─────────────────────────────────────────────────────────────────────────────
// FeedbackHost (issue #257) — mounted once in the root layout, above the Stack.
//
// Owns the floating button and the sheet. Tapping the button:
//   1. hides the button (capture must not show it),
//   2. captures the current screen,
//   3. opens the sheet with the image (or a "couldn't capture" note).
// The route is read when the button is tapped, so it is the screen the tester
// was looking at, not the sheet.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSegments } from 'expo-router';
import { captureCurrentScreen } from './captureScreen';
import { FeedbackButton } from './FeedbackButton';
import { FeedbackSheet } from './FeedbackSheet';
import { routeFromSegments, shouldShowFeedbackButton } from './feedbackLogic';
import { useSettingsStore } from '@/stores/settings.store';
import { useAuthStore } from '@/stores/auth.store';
import { FEEDBACK_ENABLED } from '@/config/feedback';

/** Tracks whether the on-screen keyboard is open (the button hides while it is). */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // iOS reports "will" events earlier, which avoids a flash of the button.
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(show, () => setOpen(true));
    const b = Keyboard.addListener(hide, () => setOpen(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return open;
}

export function FeedbackHost() {
  const segments = useSegments();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userEnabled = useSettingsStore((s) => s.feedbackButtonEnabled);
  const keyboardOpen = useKeyboardOpen();

  const [capturing, setCapturing] = useState(false);
  const [sheet, setSheet] = useState<{
    // New value per opening: remounts the sheet so it starts empty.
    id: number;
    screenshotUri: string | null;
    route: string;
    // False while the Modal plays its slide-down; the content is dropped after.
    open: boolean;
  } | null>(null);

  const visible = shouldShowFeedbackButton({
    buildEnabled: FEEDBACK_ENABLED,
    userEnabled,
    isAuthenticated,
    segments,
    keyboardOpen,
    sheetOpen: sheet?.open === true,
    capturing,
  });

  const open = useCallback(async () => {
    if (capturing) return;
    Haptics.selectionAsync().catch(() => {});
    // Read the route now: this is the screen the tester wants to report on.
    const route = routeFromSegments(segments);
    // Rendering hides the button for the capture; the capture waits a frame.
    setCapturing(true);
    const uri = await captureCurrentScreen();
    setCapturing(false);
    setSheet({ id: Date.now(), screenshotUri: uri, route, open: true });
  }, [capturing, segments]);

  // Close: let the Modal slide down, then drop the sheet (and the screenshot
  // held in memory) a moment later unless it was opened again meanwhile.
  const close = useCallback(() => {
    setSheet((s) => (s ? { ...s, open: false } : s));
    setTimeout(() => {
      setSheet((s) => (s && !s.open ? null : s));
    }, 500);
  }, []);

  // Signing out (or a route change into auth) while the sheet is open closes it.
  useEffect(() => {
    if (!isAuthenticated) setSheet(null);
  }, [isAuthenticated]);

  if (!FEEDBACK_ENABLED || !isAuthenticated) return null;

  return (
    <>
      {visible ? <FeedbackButton onPress={open} /> : null}
      {sheet ? (
        <FeedbackSheet
          key={sheet.id}
          visible={sheet.open}
          screenshotUri={sheet.screenshotUri}
          captureFailed={sheet.screenshotUri === null}
          route={sheet.route}
          onClose={close}
        />
      ) : null}
    </>
  );
}
