// ─────────────────────────────────────────────────────────────────────────────
// AI message access (issue #172): approve or withdraw, and the account-wide
// "Keep AI out of all my chats" switch.
//
// Same shape as change-password.tsx: BackHeader + ScrollView + a pinned CTA.
// Reached from Settings → Privacy and from the chat bar's links. Pushes from the
// right like the other account screens.
//
// Rules: the wording shown is the server's (the current wording to approve, or
// the wording STORED on the person's record once approved). Nothing is
// optimistic: the screen changes in place only after the server answers, with
// no toast. Wording is a DRAFT pending owner or legal sign-off.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, EXShadow } from '@/components/explorer/theme';
import {
  BackHeader,
  CoralSubmit,
  InfoNote,
  InlineError,
} from '@/components/explorer/AccountForm';
import { Card, SectionTitle } from '@/components/explorer/primitives';
import {
  AI_COPY,
  accountWideError,
  approvalError,
  approvalMode,
  chatSwitchView,
  withdrawConfirmBody,
} from '@/components/explorer/aiMessageAccessLogic';
import {
  useAiMessageAccessState,
  useApproveAiAccess,
  useConversation,
  useSetChatAiAccess,
  useSetAccountWideOff,
  useWithdrawAiAccess,
} from '@/hooks/useAiMessageAccess';
import { fmtDate } from '@/components/explorer/liveDate';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { useIsOffline } from '@/utils/networkStatus';
import type { AiMessageAccessState } from '@/types/ai-message-access.type';

// ── Outline button (the system keeps Danger for delete flows, so withdraw is Outline) ─
// Same size, radius and position as `CoralSubmit` (54pt, radius 16, full width,
// label centred). The Pressable `style` is a STATIC object: the function form
// `({ pressed }) => …` renders unstyled under NativeWind css-interop (#190), which
// showed as bare left-aligned text (#193). Pressed feedback comes from a state
// flag set by onPressIn / onPressOut instead.
function OutlineButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const off = !!disabled || !!loading;
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: !!loading }}
      style={{
        height: 54,
        borderRadius: EX.radius.button,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: EX.color.cardWhite,
        borderWidth: 1.5,
        borderColor: EX.color.line16,
        opacity: off ? 0.6 : pressed ? 0.7 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color={EX.color.ink} />
      ) : (
        <Text
          style={{ fontSize: 15.5, fontWeight: '700', color: EX.color.ink }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ── Wording card: heading, then the exact wording (no version id shown, #193) ─
// The version is still stored with the approval and sent on approve; it is just
// not something the person needs to read.
function WordingCard({ heading, text }: { heading: string; text: string }) {
  // The server joins paragraphs with a blank line; show them 12 apart.
  const paragraphs = text.split('\n\n');
  return (
    <Card>
      <Text style={{ fontSize: 14, fontWeight: '700', color: EX.color.ink }}>
        {heading}
      </Text>
      <View style={{ gap: 12, marginTop: 10 }}>
        {paragraphs.map((p, i) => (
          <Text
            key={i}
            style={{ fontSize: 14.5, lineHeight: 21, color: EX.color.ink2 }}
          >
            {p}
          </Text>
        ))}
      </View>
    </Card>
  );
}

// ── "This chat": the per-chat switch (only when opened from a chat) ──────────
// Not optimistic: the switch keeps the server's value until the call returns.
// Works for everyone (qualifying or not): it only changes MY side of the chat.
function ThisChatSection({ conversationId }: { conversationId: string }) {
  const conv = useConversation(conversationId);
  const setSwitch = useSetChatAiAccess(conversationId);
  const offline = useIsOffline();
  const [saveError, setSaveError] = useState<{
    off: boolean;
    status?: number;
  } | null>(null);

  const view = chatSwitchView({
    aiAccess: conv.data?.aiAccess,
    saving: setSwitch.isPending ? { off: !!setSwitch.variables } : null,
    offline,
    saveError,
  });

  const toggle = (off: boolean) => {
    setSaveError(null);
    setSwitch.mutate(off, {
      onError: (e) =>
        setSaveError({ off, status: (e as { status?: number })?.status }),
    });
  };

  return (
    <>
      <SectionTitle>{AI_COPY.thisChat}</SectionTitle>
      <View
        style={[
          {
            backgroundColor: EX.color.cardWhite,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: EX.color.line06,
            paddingVertical: 15,
            paddingHorizontal: 16,
          },
          EXShadow.card,
        ]}
      >
        {view ? (
          <>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: EX.color.ink,
                  }}
                >
                  {AI_COPY.chatSwitchTitle}
                </Text>
                {view.helper ? (
                  <Text
                    style={{
                      fontSize: 13,
                      lineHeight: 19,
                      color: EX.color.inkMuted,
                      marginTop: 2,
                    }}
                  >
                    {view.helper}
                  </Text>
                ) : null}
              </View>
              {view.busy ? (
                <ActivityIndicator size="small" color={EX.color.primary} />
              ) : null}
              <Switch
                value={view.value}
                onValueChange={() => toggle(view.nextOff)}
                disabled={view.disabled}
                trackColor={{ false: EX.color.line10, true: EX.color.primary }}
                thumbColor="#fff"
                ios_backgroundColor={EX.color.line10}
                accessibilityLabel={AI_COPY.chatSwitchTitle}
                accessibilityHint={view.helper ?? undefined}
                accessibilityState={{
                  checked: view.value,
                  disabled: view.disabled,
                  busy: view.busy,
                }}
                style={{ opacity: view.disabled ? 0.6 : 1 }}
              />
            </View>
            {view.error ? (
              <View style={{ marginTop: 10 }}>
                <InlineError message={view.error} />
              </View>
            ) : null}
          </>
        ) : conv.isLoading ? (
          <ActivityIndicator color={EX.color.primary} />
        ) : (
          <InlineError message={AI_COPY.errChatLoad} />
        )}
      </View>
    </>
  );
}

// ── "All chats": the account-wide switch (on = AI kept out of every chat) ────
function AllChatsSection({
  state,
  offline,
}: {
  state: AiMessageAccessState;
  offline: boolean;
}) {
  const setOff = useSetAccountWideOff();
  const [error, setError] = useState<string | null>(null);
  const saving = setOff.isPending;
  const disabled = saving || offline;

  // Not optimistic: the switch keeps the server's value until the call returns.
  const toggle = () => {
    const next = !state.accountWideOff;
    setError(null);
    setOff.mutate(next, { onError: () => setError(accountWideError(next)) });
  };

  const helper = saving
    ? AI_COPY.saving
    : offline
      ? AI_COPY.offline
      : state.accountWideOff
        ? AI_COPY.allChatsOn
        : AI_COPY.allChatsOff;

  return (
    <>
      <SectionTitle>{AI_COPY.allChats}</SectionTitle>
      <View
        style={[
          {
            backgroundColor: EX.color.cardWhite,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: EX.color.line06,
            paddingVertical: 15,
            paddingHorizontal: 16,
          },
          EXShadow.card,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{ fontSize: 15, fontWeight: '600', color: EX.color.ink }}
            >
              {AI_COPY.allChatsTitle}
            </Text>
            <Text
              style={{
                fontSize: 13,
                lineHeight: 19,
                color: EX.color.inkMuted,
                marginTop: 2,
              }}
            >
              {helper}
            </Text>
          </View>
          {saving ? (
            <ActivityIndicator size="small" color={EX.color.primary} />
          ) : null}
          <Switch
            value={state.accountWideOff}
            onValueChange={toggle}
            disabled={disabled}
            trackColor={{ false: EX.color.line10, true: EX.color.primary }}
            thumbColor="#fff"
            ios_backgroundColor={EX.color.line10}
            accessibilityLabel={AI_COPY.allChatsTitle}
            accessibilityHint={helper}
            accessibilityState={{
              checked: state.accountWideOff,
              disabled,
              busy: saving,
            }}
            style={{ opacity: disabled ? 0.6 : 1 }}
          />
        </View>
        {/* This row's error is separate from the approve / withdraw one. */}
        {error && !offline ? (
          <View style={{ marginTop: 10 }}>
            <InlineError message={error} />
          </View>
        ) : null}
      </View>
    </>
  );
}

export default function AiMessageAccessScreen() {
  const router = useRouter();
  // Present only when opened from a chat's header icon (#193).
  const { conversationId } = useLocalSearchParams<{
    conversationId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const offline = useIsOffline();
  const q = useAiMessageAccessState();
  // Refresh on regaining focus; previous data stays shown meanwhile.
  useRefetchOnFocus(q.refetch);
  const approve = useApproveAiAccess();
  const withdraw = useWithdrawAiAccess();
  // Error above the CTA (approve / withdraw), cleared on the next tap.
  const [ctaError, setCtaError] = useState<string | null>(null);

  const state = q.data;
  const header = (
    <BackHeader
      title={AI_COPY.screenTitle}
      insets={insets}
      onBack={() => router.back()}
    />
  );

  // ── Loading: centred coral spinner, no CTA ─────────────────────────────────
  if (q.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
        {header}
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator color={EX.color.primary} />
        </View>
      </View>
    );
  }

  // ── Load error: InlineError + "Try again"; no state is guessed ─────────────
  if (!state) {
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
        {header}
        <View
          style={{
            paddingHorizontal: EX.space.screenX,
            paddingTop: 16,
            gap: 14,
          }}
        >
          <InlineError message={AI_COPY.errLoadScreen} />
          <OutlineButton
            label={AI_COPY.tryAgain}
            onPress={() => void q.refetch()}
            loading={q.isFetching}
          />
        </View>
      </View>
    );
  }

  const mode = approvalMode(state);
  const approved = mode === 'approved';
  const ctaBusy = approve.isPending || withdraw.isPending;

  // ── Approve: send the version the screen shows; the server stores its text ──
  const onApprove = () => {
    setCtaError(null);
    approve.mutate(state.currentApprovalWording.versionId, {
      onError: () => setCtaError(approvalError('approve')),
    });
  };

  // ── Withdraw: native confirm, destructive action ───────────────────────────
  const onWithdraw = () => {
    setCtaError(null);
    Alert.alert(AI_COPY.confirmTitle, withdrawConfirmBody(state), [
      { text: AI_COPY.confirmCancel, style: 'cancel' },
      {
        text: AI_COPY.confirmWithdraw,
        style: 'destructive',
        onPress: () =>
          withdraw.mutate(undefined, {
            onError: () => setCtaError(approvalError('withdraw')),
          }),
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {header}

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: EX.space.screenX,
          paddingTop: 16,
          paddingBottom: EX.space.ctaClear,
          gap: 14,
        }}
      >
        {/* "This chat" row: only when opened from a chat, never from Settings. */}
        {conversationId ? (
          <ThisChatSection conversationId={conversationId} />
        ) : null}

        {approved ? (
          <>
            <View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: EX.color.ink,
                  letterSpacing: -0.18,
                }}
              >
                {AI_COPY.approvedHeading}
              </Text>
              <Text
                style={{
                  fontSize: 13.5,
                  color: EX.color.inkMuted,
                  marginTop: 3,
                }}
              >
                Approved on {fmtDate(state.approvedAt, 'd MMM yyyy')}
              </Text>
              {state.accountWideOff ? (
                <Text
                  style={{
                    fontSize: 13.5,
                    color: EX.color.inkMuted,
                    marginTop: 6,
                  }}
                >
                  {AI_COPY.approvalLineAccountOff}
                </Text>
              ) : null}
            </View>
            {/* The wording STORED on their record, not the current constant. */}
            <WordingCard
              heading={AI_COPY.cardApproved}
              text={state.wording ?? ''}
            />
          </>
        ) : (
          <>
            {mode === 'plan-only' ? (
              <InfoNote>{AI_COPY.planNote}</InfoNote>
            ) : null}
            {state.accountWideOff ? (
              <Text style={{ fontSize: 13.5, color: EX.color.inkMuted }}>
                {AI_COPY.approvalLineAccountOff}
              </Text>
            ) : null}
            <Text
              style={{ fontSize: 14.5, lineHeight: 21, color: EX.color.ink2 }}
            >
              {mode === 'plan-only' ? AI_COPY.introPlan : AI_COPY.introDefault}
            </Text>
            <WordingCard
              heading={AI_COPY.cardApproving}
              text={state.currentApprovalWording.text}
            />
            <InfoNote>{AI_COPY.infoNote}</InfoNote>
          </>
        )}

        {/* Account-wide switch: shown in every state of this screen. */}
        <AllChatsSection state={state} offline={offline} />
      </ScrollView>

      {/* ── Pinned CTA, with its own error (or the offline line) above ────────── */}
      <View
        style={{
          paddingHorizontal: EX.space.screenX,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16) + 6,
          gap: 10,
          backgroundColor: EX.color.glassWarm,
          borderTopWidth: 1,
          borderTopColor: EX.color.line06,
        }}
      >
        <InlineError message={offline ? AI_COPY.offline : ctaError} />
        {approved ? (
          <OutlineButton
            label={AI_COPY.withdrawButton}
            onPress={onWithdraw}
            loading={withdraw.isPending}
            disabled={offline || ctaBusy}
          />
        ) : (
          <CoralSubmit
            label={AI_COPY.approveButton}
            onPress={onApprove}
            loading={approve.isPending}
            disabled={offline || ctaBusy}
          />
        )}
      </View>
    </View>
  );
}
