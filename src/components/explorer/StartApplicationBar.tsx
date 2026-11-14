// ─────────────────────────────────────────────────────────────────────────────
// Sticky "Start application" bar (japa#174) — shared by visa/[id] and
// destination/[id]. Renders the states of `useStartApplication`:
//   default      price + coral CTA
//   in progress  white spinner in the CTA, not pressable
//   upgrade      UpgradePrompt (its "See plans" is the only coral button) + "Not now"
//   unavailable  InlineError, CTA disabled (60%) for this visit
//   retry        InlineError, CTA enabled (it is the retry)
//   duplicate    (#253) bottom sheet: continue the existing application or start a new one
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { InlineError } from '@/components/explorer/AccountForm';
import { UpgradePrompt } from '@/components/explorer/UpgradePrompt';
import { DuplicateApplicationSheet } from '@/components/explorer/DuplicateApplicationSheet';
import type {
  DuplicateApplication,
  StartFailure,
} from '@/hooks/useStartApplication';

/** Copy lives here so both screens say the same thing. */
export const START_COPY = {
  upgrade:
    'Your plan doesn’t cover another application right now. See plans to start this one.',
  unavailable: 'This visa isn’t available to start right now.',
  retry:
    'We couldn’t start your application. Check your connection and try again.',
} as const;

/** Rough height of the bar's extra content, so screens can pad their scroll area. */
export function startBarExtraHeight(failure: StartFailure | null): number {
  if (failure === 'upgrade') return 150;
  if (failure) return 56;
  return 0;
}

export function StartApplicationBar({
  price,
  creating,
  failure,
  onStart,
  onDismissUpgrade,
  duplicate = null,
  onContinueExisting,
  onStartAnyway,
  onDismissDuplicate,
}: {
  /** "Starting at" price (display only; see the naira follow-up). */
  price: number;
  creating: boolean;
  failure: StartFailure | null;
  onStart: () => void;
  onDismissUpgrade: () => void;
  /** #253: the user's existing application for this visa, when the backend said so. */
  duplicate?: DuplicateApplication | null;
  onContinueExisting?: () => void;
  onStartAnyway?: () => void;
  onDismissDuplicate?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const disabled = creating || failure === 'unavailable';
  return (
    <BlurView
      intensity={30}
      tint="light"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: 16,
        paddingHorizontal: 20,
        paddingBottom: Math.max(insets.bottom, 16) + 6,
        backgroundColor: EX.color.glassWarmSoft,
        borderTopWidth: 1,
        borderTopColor: EX.color.line06,
      }}
    >
      {failure === 'upgrade' ? (
        <View>
          <UpgradePrompt message={START_COPY.upgrade} />
          <PressableStatic
            onPress={onDismissUpgrade}
            accessibilityRole="button"
            style={{
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 13.5,
                fontWeight: '700',
                color: EX.color.inkMuted,
              }}
            >
              Not now
            </Text>
          </PressableStatic>
        </View>
      ) : (
        <>
          {failure ? (
            <View style={{ marginBottom: 12 }}>
              <InlineError message={START_COPY[failure]} />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View>
              <Text
                style={{
                  fontSize: 11.5,
                  color: EX.color.muted,
                  fontWeight: '500',
                }}
              >
                Starting at
              </Text>
              <Text
                style={{
                  fontSize: 21,
                  fontWeight: '700',
                  color: EX.color.ink,
                  letterSpacing: -0.21,
                }}
              >
                ${price.toLocaleString()}
              </Text>
            </View>
            <PressableStatic
              onPress={onStart}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={
                creating ? 'Starting your application' : 'Start application'
              }
              style={{
                flex: 1,
                height: 54,
                borderRadius: 16,
                backgroundColor: EX.color.primary,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                // In flight stays full opacity (spinner shows progress);
                // only an unavailable visa dims the CTA.
                opacity: failure === 'unavailable' ? 0.6 : 1,
                shadowColor: EX.color.primary,
                shadowOpacity: 0.45,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 10 },
                elevation: 6,
              }}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text
                    style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}
                  >
                    Start application
                  </Text>
                  <Ic.arrow size={18} color="#fff" strokeWidth={1.8} />
                </>
              )}
            </PressableStatic>
          </View>
        </>
      )}
      {/* #253: the "you already have this" prompt (a Modal, so it floats above the bar). */}
      <DuplicateApplicationSheet
        duplicate={duplicate}
        onContinue={onContinueExisting ?? (() => {})}
        onStartNew={onStartAnyway ?? (() => {})}
        onDismiss={onDismissDuplicate ?? (() => {})}
      />
    </BlurView>
  );
}
