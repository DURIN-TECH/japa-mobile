// ─────────────────────────────────────────────────────────────────────────────
// UploadSourceSheet (japa#420) — "Add a document": where does it come from?
//
// Opened by every document upload control (self-service requirement card,
// checklist item, Step 2 general upload, refusal letter). Layout, copy and
// motion follow the design spec on the issue:
//
//   backdrop (EXScrim.sheet, tap = close)
//   card: grab bar · "Add a document"
//         ListRow group: Photo library · Take a photo · Files (+ hint)
//         Outline "Cancel"
//
// The shell is the DuplicateApplicationSheet pattern (transparent Modal,
// rounded-top card, grab bar, PressableStatic for every press) with the
// motion of ExploreFilterSheet: animationType="none", the card slides and
// the backdrop fades separately. Open 320 ms slide + 280 ms fade, close
// 240 ms, on the system's one curve. Reduced motion: a 200 ms fade of both,
// no slide. Swipe down on the card closes past 25% of its height or faster
// than 1000 pt/s, otherwise it settles back.
//
// CLOSING vs CHOOSING. Cancel, backdrop, swipe down, Android back and the
// VoiceOver escape all close the sheet and call `onClose` (nothing else).
// A row tap disables the rows at once (no double pick), closes the sheet and
// calls `onChoose(source)` only AFTER the Modal has fully gone: iOS refuses
// to present the photo picker / camera / Files over a Modal that is still
// dismissing. On iOS that moment is the Modal's `onDismiss`; on Android the
// close timer. A fallback timer makes sure the parent is always told once,
// even if `onDismiss` never fires.
//
// The parent keeps this mounted and drives `visible`; the sheet owns its own
// Modal visibility so it can animate out before hiding.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { Ic } from '@/components/explorer/icons';
import {
  EX,
  EXScrim,
  EXShadow,
  displayText,
} from '@/components/explorer/theme';
import type { UploadSource } from '@/components/explorer/pickUploadFile';

/** Copy lives here (exported) so tests and screens agree (spec "Copy"). */
export const UPLOAD_SOURCE_COPY = {
  title: 'Add a document',
  library: 'Photo library',
  camera: 'Take a photo',
  files: 'Files',
  filesHint: 'PDF, JPEG or PNG',
  cancel: 'Cancel',
  /** Backdrop accessibility label. */
  closeLabel: 'Close',
} as const;

// ── Motion constants (spec "Motion"), as in ExploreFilterSheet ──────────────
/** The system's one curve. */
const CURVE = Easing.bezier(0.2, 0.8, 0.2, 1);
const OPEN_SLIDE_MS = 320;
const OPEN_FADE_MS = 280;
const CLOSE_MS = 240;
const REDUCED_MS = 200;
const CLOSE_DISTANCE = 0.25;
const CLOSE_VELOCITY = 1000;
/** Longest wait for iOS's `onDismiss` before the parent is told anyway. */
const DISMISS_FALLBACK_MS = 600;

/** The three rows, in the spec's order (decision 1: library first). */
const ROWS: {
  source: UploadSource;
  icon: React.ElementType;
  label: string;
  hint?: string;
  a11yLabel: string;
  a11yHint: string;
}[] = [
  {
    source: 'library',
    icon: Ic.image,
    label: UPLOAD_SOURCE_COPY.library,
    a11yLabel: UPLOAD_SOURCE_COPY.library,
    a11yHint: 'Opens your photos',
  },
  {
    source: 'camera',
    icon: Ic.camera,
    label: UPLOAD_SOURCE_COPY.camera,
    a11yLabel: UPLOAD_SOURCE_COPY.camera,
    a11yHint: 'Opens the camera',
  },
  {
    source: 'files',
    icon: Ic.folder,
    label: UPLOAD_SOURCE_COPY.files,
    hint: UPLOAD_SOURCE_COPY.filesHint,
    a11yLabel: `${UPLOAD_SOURCE_COPY.files}, ${UPLOAD_SOURCE_COPY.filesHint}`,
    a11yHint: 'Opens your files',
  },
];

// ── One row: the ListRow look (SettingsRow), rebuilt on PressableStatic ─────
function SourceRow({
  row,
  divider,
  disabled,
  onPress,
}: {
  row: (typeof ROWS)[number];
  /** Top divider (every row but the first). */
  divider: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const IconCmp = row.icon;
  return (
    <PressableStatic
      testID={`uploadSourceSheet.${row.source}`}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={row.a11yLabel}
      accessibilityHint={row.a11yHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 15,
        paddingHorizontal: 16,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: EX.color.line06,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {/* 36px cream icon chip, coral 19px icon (as SettingsRow). */}
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: EX.color.cream,
        }}
      >
        <IconCmp size={19} color={EX.color.primary} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: EX.color.ink }}>
          {row.label}
        </Text>
        {/* Optional hint line (spec proposal 2): note 13/400 ink-muted. */}
        {row.hint ? (
          <Text
            style={{
              marginTop: 2,
              fontSize: 13,
              lineHeight: 19,
              color: EX.color.inkMuted,
            }}
          >
            {row.hint}
          </Text>
        ) : null}
      </View>
      <Ic.chevR size={18} color="rgba(23,19,38,0.32)" strokeWidth={1.8} />
    </PressableStatic>
  );
}

// ── The sheet ────────────────────────────────────────────────────────────────
export function UploadSourceSheet({
  visible,
  onChoose,
  onClose,
}: {
  /** Open while true. The parent sets it false in `onChoose` / `onClose`. */
  visible: boolean;
  /** A row was tapped; called once the Modal has fully gone. */
  onChoose: (source: UploadSource) => void;
  /** Closed without a choice (any way). Nothing else should change. */
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  // The Modal's own visibility (stays true while the card animates out).
  const [shown, setShown] = useState(false);
  // Rows disabled after the first tap (no double pick).
  const [locked, setLocked] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  // What to tell the parent once hidden: a source, 'close', or nothing yet.
  const pending = useRef<UploadSource | 'close' | null>(null);
  const closing = useRef(false);
  // Measured card height (drag threshold, off-screen offset).
  const cardH = useRef(screenH);

  const translateY = useSharedValue(screenH);
  const backdrop = useSharedValue(0);
  const cardOpacity = useSharedValue(1);

  // Latest callbacks, so a timer started earlier calls the current ones.
  const cbs = useRef({ onChoose, onClose });
  cbs.current = { onChoose, onClose };

  // ── Timers (japa#420 review) ──────────────────────────────────────────────
  // The close animation timer(s) (`closeWith` / `finishDrag` → `hide`) and
  // the iOS 600 ms backup that stands in for a missing `onDismiss`. Their ids
  // are kept so that:
  //  - the backup is cleared the moment the choice is delivered (normally by
  //    `onDismiss`), and again when the sheet opens: a backup left over from
  //    the previous opening must never fire into the NEW opening and hand the
  //    parent a fresh choice while this Modal is still on screen (iOS would
  //    then refuse to present the picker);
  //  - nothing fires after unmount (no setState / parent call on a dead
  //    sheet).
  const closeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const backupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Cancel the iOS backup timer, if one is waiting. */
  const clearBackup = useCallback(() => {
    if (backupTimer.current !== null) {
      clearTimeout(backupTimer.current);
      backupTimer.current = null;
    }
  }, []);
  /** Start a close timer and remember its id (cleared on unmount). */
  const startCloseTimer = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      // Forget this id once it has run; the list only holds pending ones.
      closeTimers.current = closeTimers.current.filter((t) => t !== id);
      fn();
    }, ms);
    closeTimers.current.push(id);
  };
  // Unmount: drop every timer still waiting.
  useEffect(
    () => () => {
      for (const t of closeTimers.current) clearTimeout(t);
      closeTimers.current = [];
      clearBackup();
    },
    [clearBackup],
  );

  /** Tell the parent what happened, exactly once per opening. */
  const deliver = useCallback(() => {
    // Whoever delivers first (onDismiss or the backup) wins; the backup is
    // no longer needed either way.
    clearBackup();
    const p = pending.current;
    pending.current = null;
    if (p === null) return;
    if (p === 'close') cbs.current.onClose();
    else cbs.current.onChoose(p);
  }, [clearBackup]);

  // ── Open ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || shown) return;
    // A backup from the previous opening must not deliver into this one.
    clearBackup();
    closing.current = false;
    pending.current = null;
    setLocked(false);
    translateY.value = screenH;
    backdrop.value = 0;
    setShown(true);
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (!alive) return;
        setReduceMotion(!!reduced);
        if (reduced) {
          translateY.value = 0;
          cardOpacity.value = 0;
          cardOpacity.value = withTiming(1, { duration: REDUCED_MS });
          backdrop.value = withTiming(1, { duration: REDUCED_MS });
        } else {
          cardOpacity.value = 1;
          translateY.value = withTiming(0, {
            duration: OPEN_SLIDE_MS,
            easing: CURVE,
          });
          backdrop.value = withTiming(1, {
            duration: OPEN_FADE_MS,
            easing: CURVE,
          });
        }
      });
    return () => {
      alive = false;
    };
    // Shared values are stable; only a new opening restarts this.
  }, [visible]);

  // The parent hid the sheet itself (rare): hide without telling it again.
  useEffect(() => {
    if (!visible && shown && !closing.current) setShown(false);
  }, [visible, shown]);

  /** Hide the Modal, then tell the parent (onDismiss on iOS, else now). */
  const hide = useCallback(() => {
    setShown(false);
    if (Platform.OS === 'ios') {
      // iOS: `onDismiss` normally delivers first and clears this backup; it
      // only fires when `onDismiss` never comes. Replace (never stack) one.
      clearBackup();
      backupTimer.current = setTimeout(() => {
        backupTimer.current = null;
        deliver();
      }, DISMISS_FALLBACK_MS);
    } else deliver();
  }, [deliver, clearBackup]);

  /**
   * Animate out from wherever the card is, then hide. `what` is the source
   * tapped, or 'close'. A ref guards against two closes (a backdrop tap
   * during a swipe).
   */
  const closeWith = (what: UploadSource | 'close') => {
    if (closing.current) return;
    closing.current = true;
    pending.current = what;
    if (what !== 'close') setLocked(true);
    if (reduceMotion) {
      cardOpacity.value = withTiming(0, { duration: REDUCED_MS });
      backdrop.value = withTiming(0, { duration: REDUCED_MS });
    } else {
      translateY.value = withTiming(cardH.current, {
        duration: CLOSE_MS,
        easing: CURVE,
      });
      backdrop.value = withTiming(0, { duration: CLOSE_MS, easing: CURVE });
    }
    // Hide once the close animation has run (id kept for unmount).
    startCloseTimer(hide, reduceMotion ? REDUCED_MS : CLOSE_MS);
  };
  const dismiss = () => closeWith('close');

  // ── Drag to close (whole card; no inner scroll to fight) ──────────────────
  const dragY = useRef(0);
  const follow = (dy: number) => {
    if (closing.current) return;
    const y = Math.max(0, dy);
    dragY.current = y;
    translateY.value = y;
    backdrop.value = 1 - Math.min(1, y / cardH.current);
  };
  const finishDrag = (vy: number) => {
    const y = dragY.current;
    dragY.current = 0;
    if (y <= 0 || closing.current) return;
    if (y > cardH.current * CLOSE_DISTANCE || vy > CLOSE_VELOCITY) {
      // Reduced motion still slides out from the dragged spot here: the card
      // is already moving with the finger.
      closing.current = true;
      pending.current = 'close';
      translateY.value = withTiming(cardH.current, {
        duration: CLOSE_MS,
        easing: CURVE,
      });
      backdrop.value = withTiming(0, { duration: CLOSE_MS, easing: CURVE });
      startCloseTimer(hide, CLOSE_MS);
    } else {
      translateY.value = withTiming(0, { duration: CLOSE_MS, easing: CURVE });
      backdrop.value = withTiming(1, { duration: CLOSE_MS, easing: CURVE });
    }
  };
  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY(6)
    .onUpdate((e) => follow(e.translationY))
    .onFinalize((e) => finishDrag(e.velocityY));

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: cardOpacity.value,
  }));

  return (
    <Modal
      visible={shown}
      transparent
      animationType="none"
      statusBarTranslucent
      // Android back: close, nothing chosen.
      onRequestClose={dismiss}
      // iOS: the Modal has fully gone; now the picker may open.
      onDismiss={deliver}
    >
      {/* RNGH needs its own root inside a Modal (Android). */}
      <GestureHandlerRootView style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* ── Backdrop: tap = close ─────────────────────────────────────── */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: EXScrim.sheet,
            },
            backdropStyle,
          ]}
        >
          <PressableStatic
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel={UPLOAD_SOURCE_COPY.closeLabel}
            style={{ flex: 1 }}
          />
        </Animated.View>

        {/* ── Card ──────────────────────────────────────────────────────── */}
        <GestureDetector gesture={pan}>
          <Animated.View
            testID="uploadSourceSheet"
            accessibilityViewIsModal
            onAccessibilityEscape={dismiss}
            onLayout={(e) => {
              cardH.current = e.nativeEvent.layout.height || screenH;
            }}
            style={[
              {
                maxHeight: screenH * 0.9,
                backgroundColor: EX.color.bg,
                borderTopLeftRadius: EX.radius.sheet,
                borderTopRightRadius: EX.radius.sheet,
              },
              EXShadow.sheet,
              cardStyle,
            ]}
          >
            {/* Scrolls only when large text makes the card taller than 90%. */}
            <ScrollView
              bounces={false}
              contentContainerStyle={{
                paddingTop: 10,
                paddingHorizontal: 20,
                paddingBottom: Math.max(insets.bottom, 16) + 12,
              }}
            >
              {/* Grab bar */}
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: EX.radius.pill,
                  backgroundColor: EX.color.line16,
                  alignSelf: 'center',
                  marginBottom: 16,
                }}
              />
              <Text
                accessibilityRole="header"
                style={[displayText(20, 'semibold'), { marginBottom: 16 }]}
              >
                {UPLOAD_SOURCE_COPY.title}
              </Text>

              {/* ListRow group: surface card, radius 22, line-06 dividers. */}
              <View
                style={[
                  {
                    backgroundColor: EX.color.cardWhite,
                    borderWidth: 1,
                    borderColor: EX.color.line06,
                    borderRadius: 22,
                    overflow: 'hidden',
                  },
                  EXShadow.card,
                ]}
              >
                {ROWS.map((row, i) => (
                  <SourceRow
                    key={row.source}
                    row={row}
                    divider={i > 0}
                    disabled={locked}
                    onPress={() => closeWith(row.source)}
                  />
                ))}
              </View>

              {/* Outline Cancel, full width, 52 tall. */}
              <PressableStatic
                testID="uploadSourceSheet.cancel"
                onPress={dismiss}
                accessibilityRole="button"
                accessibilityLabel={UPLOAD_SOURCE_COPY.cancel}
                style={({ pressed }) => ({
                  marginTop: 12,
                  height: 52,
                  borderRadius: EX.radius.button,
                  borderWidth: 1,
                  borderColor: EX.color.line10,
                  backgroundColor: EX.color.cardWhite,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: EX.color.ink,
                    fontSize: 15,
                    fontWeight: '700',
                  }}
                >
                  {UPLOAD_SOURCE_COPY.cancel}
                </Text>
              </PressableStatic>
            </ScrollView>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}
