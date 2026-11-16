// ─────────────────────────────────────────────────────────────────────────────
// Destination heart — save / remove toggle (japa#146, design spec A–C).
//
//   useSavedHeart(...)   all the behaviour: which state, what a tap does,
//                        haptics, announcements, the floating failure message
//   SavedHeartIcon       the icon handed to GlassButton: an outline heart with
//                        a coral-filled copy on top that fades in / out, plus
//                        the 1 → 1.15 → 1 "pop" when the user saves
//   FloatingSaveError    the InlineError that floats under the glass row
//
// States (from savedLogic.heartState):
//   notSaved  white outline                   tap = save (optimistic)
//   saved     coral fill, white stroke kept   tap = remove (optimistic)
//   loading   white spinner, disabled         tap = nothing
//   error     outline at 60%                  tap = refetch the list ONLY
// A write in flight for this destination ignores taps until it settles
// (no double request, no flip-flop). A failed write reverts the heart and the
// cached list (the hook), then shows the message for 5s.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { EX } from './theme';
import { Ic } from './icons';
import { InlineError } from './AccountForm';
import {
  HEART_ANNOUNCE,
  HEART_LABEL,
  LIST_LOAD_FAILED,
  heartState,
  saveErrorCopy,
  type HeartState,
} from './savedLogic';
import {
  useRemoveDestination,
  useSaveDestination,
  useSavedDestinationPending,
  useSavedDestinations,
  type SaveDestinationInput,
} from '@/hooks/useSavedDestinations';

/** The system's one motion curve. */
const CURVE = Easing.bezier(0.2, 0.8, 0.2, 1);
/** How long the floating message stays before fading out. */
const ERROR_MS = 5000;

// ── "Pop" signal ─────────────────────────────────────────────────────────────
// GlassButton only passes size / colour / stroke / fill to its icon, so the
// one extra fact the icon needs (was this change a user SAVE, which pops, or
// a remove / rollback, which only fades?) travels through this context.
const PopContext = createContext<{ current: boolean }>({ current: false });

/** Wrap the heart's GlassButton so its icon can read the pop signal. */
export function SavedHeartProvider({
  pop,
  children,
}: {
  pop: { current: boolean };
  children: React.ReactNode;
}) {
  return <PopContext.Provider value={pop}>{children}</PopContext.Provider>;
}

// ── Icon ─────────────────────────────────────────────────────────────────────

/**
 * Heart icon for GlassButton. `fill` set (and not "none") = saved. The coral
 * layer fades over 200ms on the curve; a save also pops the icon. Reduced
 * motion: instant swap, no scale. The first render never animates.
 */
export function SavedHeartIcon({
  size = 21,
  color = '#fff',
  strokeWidth = 1.8,
  fill,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}) {
  const filled = !!fill && fill !== 'none';
  const pop = useContext(PopContext);
  const reduced = useReducedMotion();
  const fillOpacity = useSharedValue(filled ? 1 : 0);
  const scale = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const popNow = filled && pop.current;
    pop.current = false; // consumed: a later rollback must not pop
    if (reduced) {
      fillOpacity.value = filled ? 1 : 0;
      scale.value = 1;
      return;
    }
    fillOpacity.value = withTiming(filled ? 1 : 0, {
      duration: 200,
      easing: CURVE,
    });
    if (popNow) {
      scale.value = withSequence(
        withTiming(1.15, { duration: 150, easing: CURVE }),
        withTiming(1, { duration: 200, easing: CURVE }),
      );
    }
    // Only a change of `filled` animates (shared values / refs are stable).
  }, [filled]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: fillOpacity.value }));

  return (
    <Animated.View style={[{ width: size, height: size }, scaleStyle]}>
      <Ic.heart size={size} color={color} strokeWidth={strokeWidth} />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, fillStyle]}
      >
        <Ic.heart
          size={size}
          color={color}
          strokeWidth={strokeWidth}
          fill={EX.color.primary}
        />
      </Animated.View>
    </Animated.View>
  );
}

// ── Behaviour ────────────────────────────────────────────────────────────────

/** The floating message: `fade` = fade out (timer) vs vanish (tap / leave). */
export interface HeartError {
  message: string | null;
  fade: boolean;
}

/** Announce to a screen reader (never throws). */
function announce(text: string) {
  try {
    AccessibilityInfo.announceForAccessibility(text);
  } catch {
    // Not available (tests / web): nothing to announce to.
  }
}

/**
 * Everything the destination heart needs. `visa` is the loaded visa (used to
 * draw the optimistic tile on the Saved screen); until it is known a tap does
 * nothing.
 */
export function useSavedHeart({
  countryCode,
  visaId,
  visa,
  countryName,
}: {
  countryCode: string;
  visaId: string;
  visa: SaveDestinationInput['visa'] | undefined;
  countryName?: string;
}) {
  const listQ = useSavedDestinations();
  const save = useSaveDestination(countryCode, visaId);
  const remove = useRemoveDestination(countryCode, visaId);
  const pending = useSavedDestinationPending(countryCode, visaId);

  const state: HeartState = heartState({
    list: listQ.data,
    isFetching: listQ.isFetching,
    isError: listQ.isError,
    countryCode,
    visaId,
  });

  // Pop signal for SavedHeartIcon (see PopContext).
  const pop = useRef(false);
  // Synchronous double-tap guard: `pending` only updates on the next render.
  const busy = useRef(false);

  // ── Floating message (5s, one at a time) ─────────────────────────────────
  const [error, setError] = useState<HeartError>({
    message: null,
    fade: false,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const showError = useCallback((message: string) => {
    clearTimer();
    setError({ message, fade: false });
    announce(message);
    timer.current = setTimeout(
      () => setError({ message: null, fade: true }),
      ERROR_MS,
    );
  }, []);
  const dropError = useCallback(() => {
    clearTimer();
    setError((e) => (e.message ? { message: null, fade: false } : e));
  }, []);

  // Leaving the screen (blur or unmount) clears the message and its timer.
  useFocusEffect(useCallback(() => dropError, [dropError]));
  useEffect(() => clearTimer, []);

  /** A write failed: the hook already reverted the list; tell the user. */
  const onWriteError = (e: unknown, action: 'save' | 'remove') => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
      () => {},
    );
    const message = saveErrorCopy(e, action);
    if (message) showError(message);
  };

  const onPress = () => {
    // The next tap clears the message at once.
    dropError();
    if (state === 'loading') return;

    // List failed: the tap retries loading only (it never also toggles).
    if (state === 'error') {
      void listQ.refetch().then((r) => {
        if (r.isError) showError(LIST_LOAD_FAILED);
      });
      return;
    }

    // A write for this destination is in flight: ignore until it settles.
    if (pending || busy.current || !visa) return;
    busy.current = true;
    Haptics.selectionAsync().catch(() => {});

    if (state === 'saved') {
      pop.current = false;
      remove.mutate(undefined, {
        onSuccess: () => announce(HEART_ANNOUNCE.removed),
        onError: (e) => onWriteError(e, 'remove'),
        onSettled: () => {
          busy.current = false;
        },
      });
    } else {
      pop.current = true;
      save.mutate(
        { visa, countryName },
        {
          onSuccess: () => announce(HEART_ANNOUNCE.saved),
          onError: (e) => onWriteError(e, 'save'),
          onSettled: () => {
            busy.current = false;
          },
        },
      );
    }
  };

  return {
    state,
    error,
    pop,
    /** Props for GlassButton (icon = SavedHeartIcon). */
    buttonProps: {
      icon: SavedHeartIcon,
      onPress,
      iconFill: state === 'saved' ? EX.color.primary : undefined,
      loading: state === 'loading',
      dimmed: state === 'error',
      disabled: state === 'loading',
      accessibilityLabel: HEART_LABEL[state],
      accessibilityState: { busy: state === 'loading' },
    },
  };
}

// ── Floating failure message ─────────────────────────────────────────────────

/**
 * The InlineError floating over the hero, just under the glass row
 * (`top` = insets.top + 6 + 42 + 10, left/right 18, zIndex 50). Fades in over
 * 200ms; fades out over 200ms when the timer ends, vanishes at once when a tap
 * or leaving the screen clears it.
 */
export function FloatingSaveError({
  error,
  top,
}: {
  error: HeartError;
  top: number;
}) {
  const reduced = useReducedMotion();
  // The message on screen (kept through the fade-out).
  const [shown, setShown] = useState<string | null>(error.message);
  const opacity = useSharedValue(error.message ? 1 : 0);

  useEffect(() => {
    if (error.message) {
      setShown(error.message);
      opacity.value = 0;
      opacity.value = reduced
        ? 1
        : withTiming(1, { duration: 200, easing: CURVE });
      return;
    }
    if (!error.fade || reduced) {
      opacity.value = 0;
      setShown(null);
      return;
    }
    opacity.value = withTiming(0, { duration: 200, easing: CURVE });
    const t = setTimeout(() => setShown(null), 200);
    return () => clearTimeout(t);
  }, [error]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!shown) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top, left: 18, right: 18, zIndex: 50 },
        style,
      ]}
    >
      <InlineError message={shown} />
    </Animated.View>
  );
}
