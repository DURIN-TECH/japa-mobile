// ─────────────────────────────────────────────────────────────────────────────
// "You already have this application" sheet (japa#253)
//
// Shown by StartApplicationBar when POST /applications answered 409
// DUPLICATE_ACTIVE_APPLICATION (see useStartApplication). Same bottom-sheet
// pattern as the reject-reason modal in app/application/[id].tsx: a
// transparent fade Modal, dimmed backdrop, rounded-top card with a grab bar.
//
//   Continue application  (primary, coral)  → open the one they have
//   Start a new one       (secondary)       → re-send with confirmNew
//   backdrop / back                         → close, nothing created
//
// Uses PressableStatic everywhere (function-style Pressable styles render
// unstyled under NativeWind, see PressableStatic.tsx).
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Modal, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { EX, displayText } from '@/components/explorer/theme';
import type { DuplicateApplication } from '@/hooks/useStartApplication';

/** Copy lives here (exported) so tests and screens agree. */
export const DUPLICATE_COPY = {
  title: 'You’ve already started this',
  /** `name` is the visa/country label when the backend sent one. */
  body: (name?: string) =>
    name
      ? `You already have an application for ${name} in progress. Pick up where you left off, or start a fresh one.`
      : 'You already have an application for this visa in progress. Pick up where you left off, or start a fresh one.',
  continue: 'Continue application',
  startNew: 'Start a new one',
} as const;

/** "Skilled Worker visa, United Kingdom" style label from whatever is present. */
/** "Draft, 30% complete" from the 409's status and progress (either may be absent). */
export function duplicateProgressLine(
  d: DuplicateApplication | null,
): string | undefined {
  if (!d) return undefined;
  const status = d.status
    ? d.status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
    : undefined;
  const pct =
    typeof d.progress === 'number'
      ? `${Math.round(d.progress)}% complete`
      : undefined;
  const parts = [status, pct].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

export function duplicateLabel(
  d: DuplicateApplication | null,
): string | undefined {
  if (!d) return undefined;
  const parts = [d.visaTypeName, d.countryName].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

export function DuplicateApplicationSheet({
  duplicate,
  onContinue,
  onStartNew,
  onDismiss,
}: {
  /** The existing application; the sheet is visible while this is set. */
  duplicate: DuplicateApplication | null;
  onContinue: () => void;
  onStartNew: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={!!duplicate}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Backdrop: tap outside to close. */}
        <PressableStatic
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: 'rgba(12,10,8,0.45)',
          }}
        />
        <View
          style={{
            backgroundColor: EX.color.bg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 10,
            paddingHorizontal: 22,
            paddingBottom: Math.max(insets.bottom, 16) + 12,
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 99,
              backgroundColor: EX.color.line16,
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />
          <Text style={[displayText(20, 'semibold'), { marginBottom: 6 }]}>
            {DUPLICATE_COPY.title}
          </Text>
          <Text
            style={{
              fontSize: 13.5,
              color: EX.color.inkMuted,
              marginBottom: duplicateProgressLine(duplicate) ? 10 : 20,
            }}
          >
            {DUPLICATE_COPY.body(duplicateLabel(duplicate))}
          </Text>
          {/* Where the existing application stands (status + progress). */}
          {duplicateProgressLine(duplicate) ? (
            <Text
              style={{
                fontSize: 13.5,
                fontWeight: '700',
                color: EX.color.ink,
                marginBottom: 20,
              }}
            >
              {duplicateProgressLine(duplicate)}
            </Text>
          ) : null}

          {/* Primary: the safe default is to continue what they have. */}
          <PressableStatic
            onPress={onContinue}
            accessibilityRole="button"
            style={{
              height: 52,
              borderRadius: 16,
              backgroundColor: EX.color.primary,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
              {DUPLICATE_COPY.continue}
            </Text>
          </PressableStatic>
          <PressableStatic
            onPress={onStartNew}
            accessibilityRole="button"
            style={{
              height: 52,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: EX.color.line12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{ color: EX.color.ink, fontSize: 15, fontWeight: '700' }}
            >
              {DUPLICATE_COPY.startNew}
            </Text>
          </PressableStatic>
        </View>
      </View>
    </Modal>
  );
}
