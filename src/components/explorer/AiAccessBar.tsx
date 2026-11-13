// ─────────────────────────────────────────────────────────────────────────────
// AI access bar + switch (issue #172).
//
// The pinned bar under the chat header, and the pieces it shares with the
// one-time notice sheet:
//   - useAiAccessControl: the conversation + chat-switch call + error, reduced
//     to a `BarView` by the pure `pickBarState` (aiMessageAccessLogic.ts)
//   - AiSwitch: the settings.tsx Switch (coral on / line-10 off), plus a small
//     spinner on its left while saving, 60% when disabled
//   - AiAccessRows: the rows for every state (loading, error, account-off, not
//     active with "Keep AI out of this chat", standard)
//   - AiAccessBar: the surface strip around the rows
//
// The switch is NOT optimistic: it shows the server's value and only moves after
// the call returns. Nothing here reads messages.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  Switch,
  Text,
  View,
} from 'react-native';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { IconChip } from '@/components/explorer/primitives';
import { InlineError } from '@/components/explorer/AccountForm';
import {
  pickBarState,
  type BarSwitch,
  type BarView,
} from '@/components/explorer/aiMessageAccessLogic';
import {
  useConversation,
  useSetChatAiAccess,
} from '@/hooks/useAiMessageAccess';
import { useIsOffline } from '@/utils/networkStatus';

// ── Hook: everything the bar and the notice need for one chat ────────────────
export function useAiAccessControl(conversationId: string) {
  const conv = useConversation(conversationId);
  const setSwitch = useSetChatAiAccess(conversationId);
  const offline = useIsOffline();
  // The last failed switch call: the `off` it tried and the HTTP status.
  const [saveError, setSaveError] = useState<{
    off: boolean;
    status?: number;
  } | null>(null);

  const view: BarView = pickBarState({
    aiAccess: conv.data?.aiAccess,
    conversationLoaded: !!conv.data,
    // A refetch in progress shows Loading again rather than a stale error.
    loadFailed: conv.isError && !conv.data && !conv.isFetching,
    offline,
    saving: setSwitch.isPending ? { off: !!setSwitch.variables } : null,
    saveError,
  });

  /** Change MY side of the chat switch. `off: true` keeps AI out. */
  const toggle = (off: boolean) => {
    setSaveError(null); // the error clears on the next tap
    setSwitch.mutate(off, {
      onError: (e) =>
        setSaveError({ off, status: (e as { status?: number })?.status }),
    });
  };

  return { view, toggle, retry: () => void conv.refetch() };
}
export type AiAccessControl = ReturnType<typeof useAiAccessControl>;

// ── Keyboard: hide helpers while it is open so the list keeps its room ───────
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setOpen(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

// ── Switch: coral on, line-10 off, white thumb; spinner left while saving ────
export function AiSwitch({
  sw,
  hint,
  onChange,
}: {
  sw: BarSwitch;
  /** The helper line, read as the switch's accessibility hint. */
  hint?: string;
  onChange: (nextOff: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {sw.busy ? (
        <ActivityIndicator size="small" color={EX.color.primary} />
      ) : null}
      <Switch
        value={sw.value}
        // Toggling reports the `off` to send; the value prop does not change
        // until the server answers (not optimistic).
        onValueChange={() => onChange(sw.nextOff)}
        disabled={sw.disabled}
        trackColor={{ false: EX.color.line10, true: EX.color.primary }}
        thumbColor="#fff"
        ios_backgroundColor={EX.color.line10}
        accessibilityLabel={sw.label}
        accessibilityHint={hint}
        accessibilityState={{
          checked: sw.value,
          disabled: sw.disabled,
          busy: sw.busy,
        }}
        style={{ opacity: sw.disabled ? 0.6 : 1 }}
      />
    </View>
  );
}

// ── Coral link with a trailing arrow (15.5 / 700) ────────────────────────────
function CoralLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
        opacity: pressed ? 0.7 : 1,
        alignSelf: 'flex-start',
      })}
    >
      <Text
        style={{ fontSize: 15.5, fontWeight: '700', color: EX.color.primary }}
      >
        {label}
      </Text>
      <Ic.arrow size={16} color={EX.color.primary} strokeWidth={2} />
    </Pressable>
  );
}

// ── Title + helper text block ────────────────────────────────────────────────
function TextBlock({
  title,
  helper,
}: {
  title: string;
  helper?: string | null;
}) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: EX.color.ink }}>
        {title}
      </Text>
      {helper ? (
        <Text
          style={{
            fontSize: 12.5,
            fontWeight: '500',
            lineHeight: 17,
            color: EX.color.inkMuted,
            marginTop: 1,
          }}
        >
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

// ── The rows for every bar state ─────────────────────────────────────────────
// `compact` (keyboard open) drops helpers and links: two title lines at most.
// `onOpenSettings` opens /ai-message-access; the caller decides whether to close
// a sheet first.
export function AiAccessRows({
  control,
  compact = false,
  onOpenSettings,
}: {
  control: AiAccessControl;
  compact?: boolean;
  onOpenSettings: () => void;
}) {
  const { view, toggle, retry } = control;

  // Loading: coral spinner, no switch.
  if (view.kind === 'loading') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconChip icon={Ic.spark} size={36} radius={11} iconSize={17} />
        <TextBlock title={view.title} helper={compact ? null : view.helper} />
        <ActivityIndicator size="small" color={EX.color.primary} />
      </View>
    );
  }

  // Load error: never shows "On" when the state is unknown.
  if (view.kind === 'load-error') {
    return (
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconChip icon={Ic.spark} size={36} radius={11} iconSize={17} />
          <TextBlock title={view.title} />
          {compact ? null : (
            <Pressable onPress={retry} hitSlop={8} accessibilityRole="button">
              <Text
                style={{
                  fontSize: 15.5,
                  fontWeight: '700',
                  color: EX.color.primary,
                }}
              >
                {view.link}
              </Text>
            </Pressable>
          )}
        </View>
        <View style={{ marginTop: 10 }}>
          <InlineError message={view.error} />
        </View>
      </View>
    );
  }

  // Not active: row 1 (approve link) + a hairline + row 2 ("Keep AI out").
  if (view.kind === 'not-active') {
    return (
      <View>
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}
        >
          <IconChip icon={Ic.spark} size={36} radius={11} iconSize={17} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <TextBlock
              title={view.title}
              helper={compact ? null : view.helper}
            />
            {compact ? null : (
              <CoralLink label={view.link} onPress={onOpenSettings} />
            )}
          </View>
        </View>
        <View
          style={{
            height: 1,
            backgroundColor: EX.color.line06,
            marginVertical: 10,
          }}
        />
        {/* Row 2 text lines up with row 1's text (36px chip + 12px gap). */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingLeft: 48,
          }}
        >
          <TextBlock
            title={view.row2.title}
            helper={compact ? null : view.row2.helper}
          />
          <AiSwitch
            sw={view.row2.switch}
            hint={view.row2.helper}
            onChange={toggle}
          />
        </View>
        {view.row2.error ? (
          <View style={{ marginTop: 10 }}>
            <InlineError message={view.row2.error} />
          </View>
        ) : null}
      </View>
    );
  }

  // Account-wide off, or the standard bar: one row with the switch on the right.
  const error = view.kind === 'standard' ? view.error : null;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconChip icon={Ic.spark} size={36} radius={11} iconSize={17} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <TextBlock title={view.title} helper={compact ? null : view.helper} />
          {view.kind === 'account-off' && !compact ? (
            <CoralLink label={view.link} onPress={onOpenSettings} />
          ) : null}
        </View>
        <AiSwitch sw={view.switch} hint={view.helper} onChange={toggle} />
      </View>
      {error ? (
        <View style={{ marginTop: 10 }}>
          <InlineError message={error} />
        </View>
      ) : null}
    </View>
  );
}

// ── The bar: pinned under the glass header, above the message list ───────────
export function AiAccessBar({
  control,
  onOpenSettings,
}: {
  control: AiAccessControl;
  onOpenSettings: () => void;
}) {
  const keyboardOpen = useKeyboardOpen();
  return (
    <View
      style={{
        backgroundColor: EX.color.cardWhite,
        borderBottomWidth: 1,
        borderBottomColor: EX.color.line06,
        paddingVertical: 10,
        paddingHorizontal: 16,
      }}
    >
      <AiAccessRows
        control={control}
        compact={keyboardOpen}
        onOpenSettings={onOpenSettings}
      />
    </View>
  );
}
