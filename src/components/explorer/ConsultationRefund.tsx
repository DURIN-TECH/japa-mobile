// ─────────────────────────────────────────────────────────────────────────────
// Consultation detail: refund card and "the meeting didn't happen" report
// (japa#356, japa#442).
//
//   • `StatusCard`: the LabelCard look (surface, radius-card 20, 1px line-06,
//     padding 16) with a 12/600 muted label, a small Pill and one 14/500
//     ink-2 body line. Used for "Refund" (japa#356 §3) and for "Your report"
//     (japa#442).
//   • `NoShowReportAction`: the "The meeting didn't happen" action. Tapping it
//     opens an inline confirm step (what happens next, an optional note, Send
//     report / Not now). While sending, the Send button shows the coral
//     spinner and cannot be pressed again. Offline, nothing is sent and an
//     InlineError says so. A server refusal shows its own message.
//
// The screen decides WHEN these show (from the booking's `refundStatus`,
// `canReportNoShow` and `noShowReport`); nothing here decides eligibility.
// Inline styles from the EX tokens, like the rest of the Explorer.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { EX } from './theme';
import { Pill } from './primitives';
import { InlineError } from './AccountForm';
import {
  NO_SHOW_ACTION,
  NO_SHOW_CONFIRM,
  type RefundCardCopy,
} from './refundCopy';
import { NO_SHOW_NOTE_MAX_LENGTH } from '@/hooks/useConsultations';

// ── StatusCard ───────────────────────────────────────────────────────────────
export function StatusCard({
  label,
  copy,
  testID,
}: {
  /** The card's small label ("Refund", "Your report"). */
  label: string;
  /** The pill and body line (refundCopy.ts). */
  copy: RefundCardCopy;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: EX.color.cardWhite,
        borderRadius: EX.radius.card,
        borderWidth: 1,
        borderColor: EX.color.line06,
        padding: 16,
        gap: 8,
      }}
    >
      {/* Label 12/600 muted (a caption, the one place `muted` is used). */}
      <Text style={{ fontSize: 12, fontWeight: '600', color: EX.color.muted }}>
        {label}
      </Text>
      <Pill label={copy.pill.label} fg={copy.pill.fg} bg={copy.pill.bg} small />
      {/* Body 14/500 ink-2, line height 20: text people must read. */}
      <Text
        style={{
          fontSize: 14,
          fontWeight: '500',
          color: EX.color.ink2,
          lineHeight: 20,
        }}
      >
        {copy.body}
      </Text>
    </View>
  );
}

// ── Outline button with an optional coral spinner ────────────────────────────
// Same look as the screen's outline ActionBtn (48 tall, radius 14, 1px
// line-12, 14.5/700 ink). `busy` swaps the label for the coral spinner and
// disables it, so a second tap can never send twice.
function OutlineAction({
  label,
  onPress,
  busy = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      style={{
        flex: 1,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: EX.color.cardWhite,
        borderWidth: 1,
        borderColor: EX.color.line12,
      }}
    >
      {busy ? (
        <ActivityIndicator color={EX.color.primary} />
      ) : (
        <Text
          style={{ fontSize: 14.5, fontWeight: '700', color: EX.color.ink }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ── NoShowReportAction ───────────────────────────────────────────────────────
export function NoShowReportAction({
  sending,
  error,
  onSend,
  onOpen,
}: {
  /** True while the report call is running (spinner, no second send). */
  sending: boolean;
  /** The message to show above the buttons, or null. */
  error: string | null;
  /** Send the report with the (possibly empty) note. */
  onSend: (note: string) => void;
  /** Called when the confirm step opens (the screen clears old errors). */
  onOpen?: () => void;
}) {
  // Closed: just the action. Open: the confirm step.
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState('');

  if (!open) {
    return (
      <View style={{ gap: 10 }}>
        {/* A server refusal (e.g. "contact support") stays readable here
            after the booking refreshed and the action may have gone. */}
        <InlineError message={error} />
        <View style={{ flexDirection: 'row' }}>
          <OutlineAction
            testID="no-show-open"
            label={NO_SHOW_ACTION}
            onPress={() => {
              onOpen?.();
              setOpen(true);
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      testID="no-show-confirm"
      style={{
        backgroundColor: EX.color.cardWhite,
        borderRadius: EX.radius.card,
        borderWidth: 1,
        borderColor: EX.color.line06,
        padding: 16,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: '700', color: EX.color.ink }}>
        {NO_SHOW_CONFIRM.title}
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '500',
          color: EX.color.ink2,
          lineHeight: 20,
        }}
      >
        {NO_SHOW_CONFIRM.body}
      </Text>
      {/* Optional note, capped at the backend's limit (1000 characters). */}
      <TextInput
        testID="no-show-note"
        value={note}
        onChangeText={setNote}
        editable={!sending}
        multiline
        maxLength={NO_SHOW_NOTE_MAX_LENGTH}
        placeholder={NO_SHOW_CONFIRM.notePlaceholder}
        placeholderTextColor={EX.color.faint}
        accessibilityLabel={NO_SHOW_CONFIRM.notePlaceholder}
        style={{
          minHeight: 84,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: EX.color.line10,
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: 12,
          fontSize: 15,
          color: EX.color.ink,
          textAlignVertical: 'top',
        }}
      />
      <InlineError message={error} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <OutlineAction
          testID="no-show-cancel"
          label={NO_SHOW_CONFIRM.back}
          onPress={() => {
            if (!sending) setOpen(false);
          }}
        />
        <OutlineAction
          testID="no-show-send"
          label={NO_SHOW_CONFIRM.send}
          busy={sending}
          onPress={() => onSend(note)}
        />
      </View>
    </View>
  );
}
