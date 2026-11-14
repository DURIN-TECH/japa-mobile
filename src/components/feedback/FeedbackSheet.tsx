// ─────────────────────────────────────────────────────────────────────────────
// FeedbackSheet (issue #257) — the bottom sheet a tester fills in.
//
// Layout and copy follow the design spec on the issue: handle, title, Bug/Idea
// cards, message box, screenshot card, "what we send" note, error, Send, Cancel.
// Built on RN `Modal` (transparent, slide) because the design system has no
// sheet component yet.
//
// States: empty · ready · screenshot kept / removed / capture failed · sending
// · failed (text kept, "Try again") · success (auto-closes) · discard confirm.
// The parent mounts this with a fresh `key` for every opening, so each opening
// starts empty.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FEEDBACK_COPY as C,
  MAX_MESSAGE_LENGTH,
  SUCCESS_CLOSE_MS,
  canSend,
  counterText,
  placeholderFor,
  sendErrorMessage,
  type FeedbackKind,
} from './feedbackLogic';
import {
  InfoNote,
  InlineError,
  LabeledInput,
} from '@/components/explorer/AccountForm';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { Ic } from '@/components/explorer/icons';
import { EX, EXShadow, displayText } from '@/components/explorer/theme';
import { submitFeedback, type UploadCache } from '@/hooks/useFeedback';

/** The sender; a prop so tests can replace the network. */
type Sender = typeof submitFeedback;

// ── KindCard: one option card of the Bug / Idea radio group ───────────────────
function KindCard({
  kind,
  selected,
  disabled,
  onSelect,
}: {
  kind: FeedbackKind;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const Icon = kind === 'bug' ? Ic.alert : Ic.spark;
  const copy = C.kinds[kind];
  return (
    <PressableStatic
      onPress={onSelect}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${copy.name}. ${copy.line}`}
      style={{
        flex: 1,
        padding: 14,
        borderRadius: EX.radius.cardSm,
        backgroundColor: selected ? EX.color.primaryTint07 : EX.color.cardWhite,
        // 1.5px coral when selected, 1px hairline otherwise (a half-pixel change).
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? EX.color.primary : EX.color.line10,
        gap: 10,
      }}
    >
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
        <Icon size={19} color={EX.color.primary} strokeWidth={1.8} />
      </View>
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: EX.color.ink }}>
          {copy.name}
        </Text>
        <Text
          style={{ fontSize: 12.5, lineHeight: 17, color: EX.color.inkMuted }}
        >
          {copy.line}
        </Text>
      </View>
    </PressableStatic>
  );
}

// ── Screenshot card: kept, removed, or capture failed ─────────────────────────
function ScreenshotCard({
  uri,
  captureFailed,
  removed,
  locked,
  onRemove,
  onAddBack,
}: {
  uri: string | null;
  captureFailed: boolean;
  removed: boolean;
  locked: boolean;
  onRemove: () => void;
  onAddBack: () => void;
}) {
  // No image and none expected: tell the tester, no add-back.
  if (!uri || captureFailed) {
    return <InfoNote>{C.captureFailed}</InfoNote>;
  }

  const card = {
    backgroundColor: EX.color.cardWhite,
    borderRadius: EX.radius.cardSm,
    borderWidth: 1,
    borderColor: EX.color.line08,
    padding: 12,
  } as const;

  if (removed) {
    return (
      <View
        style={[card, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}
      >
        <Text style={{ flex: 1, fontSize: 13.5, color: EX.color.inkMuted }}>
          {C.screenshotRemoved}
        </Text>
        <PressableStatic
          onPress={onAddBack}
          disabled={locked}
          accessibilityRole="button"
          style={{
            minHeight: 44,
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <Text
            style={{
              fontSize: 13.5,
              fontWeight: '700',
              color: EX.color.primary,
            }}
          >
            {C.addItBack}
          </Text>
        </PressableStatic>
      </View>
    );
  }

  return (
    <View style={[card, { flexDirection: 'row', gap: 12 }]}>
      <View>
        <Image
          source={{ uri }}
          accessibilityIgnoresInvertColors
          style={{
            width: 64,
            height: 112,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: EX.color.line08,
            // Neutral tone behind the image while it loads.
            backgroundColor: EX.color.flagBg,
          }}
        />
        {/* 26px dark-glass remove button; the touch target grows to 44 with hitSlop. */}
        <PressableStatic
          onPress={onRemove}
          disabled={locked}
          hitSlop={9}
          accessibilityRole="button"
          accessibilityLabel={C.removeScreenshot}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(12,10,8,0.55)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.2)',
          }}
        >
          <Ic.x size={13} color="#fff" strokeWidth={2.2} />
        </PressableStatic>
      </View>
      <View style={{ flex: 1, gap: 4, justifyContent: 'center' }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: EX.color.ink }}>
          {C.screenshotTitle}
        </Text>
        <Text
          style={{ fontSize: 12.5, lineHeight: 18, color: EX.color.inkMuted }}
        >
          {C.screenshotNote}
        </Text>
      </View>
    </View>
  );
}

// ── The sheet ─────────────────────────────────────────────────────────────────
export function FeedbackSheet({
  visible,
  screenshotUri,
  captureFailed,
  route,
  onClose,
  send = submitFeedback,
}: {
  visible: boolean;
  /** Local uri of the captured screen, or null when capture failed or was unavailable. */
  screenshotUri: string | null;
  captureFailed: boolean;
  /** Route pattern sent with the note. */
  route: string;
  onClose: () => void;
  /** Network call; defaults to the real one. */
  send?: Sender;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [message, setMessage] = useState('');
  // The captured image stays in memory (screenshotUri) until the sheet closes;
  // `removed` only decides whether it is sent, so "Add it back" works.
  const [removed, setRemoved] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedOnce, setFailedOnce] = useState(false);
  const [done, setDone] = useState(false);
  // A screenshot that already uploaded is not uploaded again on retry.
  const uploadCache = useRef<UploadCache | null>(null);

  // Reduced motion: a plain fade instead of the slide.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  const hasText = message.trim().length > 0;
  const ready = canSend(kind, message);

  // Close with a discard check when the tester typed something.
  const requestClose = useCallback(() => {
    if (sending) return;
    if (done || !hasText) {
      onClose();
      return;
    }
    Alert.alert(C.discardTitle, C.discardMessage, [
      { text: C.keepWriting, style: 'cancel' },
      { text: C.discard, style: 'destructive', onPress: onClose },
    ]);
  }, [sending, done, hasText, onClose]);

  // Success view closes itself after a moment.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onClose, SUCCESS_CLOSE_MS);
    return () => clearTimeout(t);
  }, [done, onClose]);

  // Send: upload (best effort), post, then the thank-you; on failure keep everything.
  const onSend = async () => {
    if (!ready || sending || !kind) return;
    setSending(true);
    setError(null);
    try {
      await send(
        {
          kind,
          message,
          route,
          screenshotUri: removed ? null : screenshotUri,
        },
        uploadCache,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      // The message and screenshot are cleared once sent.
      setMessage('');
      setDone(true);
    } catch (e) {
      setError(sendErrorMessage(e));
      setFailedOnce(true);
    } finally {
      setSending(false);
    }
  };

  const counter = counterText(message.length);
  const sendLabel = sending ? C.sending : failedOnce ? C.tryAgain : C.send;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'fade' : 'slide'}
      onRequestClose={requestClose}
      statusBarTranslucent
    >
      {/* Backdrop: a lighter veil than on photos; tapping it asks to close. */}
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityLabel={C.cancel}
          onPress={requestClose}
          disabled={sending}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(12,10,8,0.47)',
          }}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ maxHeight: height * 0.9 }}
        >
          <View
            style={[
              {
                backgroundColor: EX.color.bg,
                borderTopLeftRadius: EX.radius.sheet,
                borderTopRightRadius: EX.radius.sheet,
                maxHeight: height * 0.9,
              },
              EXShadow.hero,
            ]}
          >
            {/* Grab handle */}
            <View
              style={{
                alignSelf: 'center',
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: EX.color.line16,
                marginTop: 8,
                marginBottom: 16,
              }}
            />

            {done ? (
              // ── Success: the body swaps in place ──────────────────────────
              <View
                style={{
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingTop: 12,
                  paddingBottom: insets.bottom + 24,
                  gap: 8,
                }}
              >
                <LinearGradient
                  colors={[EX.color.primary, EX.color.teal]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Ic.check size={30} color="#fff" strokeWidth={2.6} />
                </LinearGradient>
                <Text
                  accessibilityRole="header"
                  style={displayText(22, 'semibold')}
                >
                  {C.successTitle}
                </Text>
                <Text
                  style={{
                    fontSize: 14.5,
                    lineHeight: 22,
                    color: EX.color.inkMuted,
                  }}
                >
                  {C.successLine}
                </Text>
                <PressableStatic
                  onPress={onClose}
                  accessibilityRole="button"
                  style={{
                    minHeight: 44,
                    justifyContent: 'center',
                    marginTop: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: EX.color.primary,
                    }}
                  >
                    {C.done}
                  </Text>
                </PressableStatic>
              </View>
            ) : (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 20,
                  paddingBottom: insets.bottom + 16,
                }}
              >
                <Text
                  accessibilityRole="header"
                  style={displayText(24, 'semibold')}
                >
                  {C.title}
                </Text>
                <Text
                  style={{
                    fontSize: 14.5,
                    lineHeight: 22,
                    color: EX.color.inkMuted,
                    marginTop: 4,
                  }}
                >
                  {C.subtitle}
                </Text>

                {/* Kind: neither preselected */}
                <View
                  accessibilityRole="radiogroup"
                  style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}
                >
                  {(['bug', 'idea'] as FeedbackKind[]).map((k) => (
                    <KindCard
                      key={k}
                      kind={k}
                      selected={kind === k}
                      disabled={sending}
                      onSelect={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setKind(k);
                      }}
                    />
                  ))}
                </View>

                {/* Message */}
                <View style={{ marginTop: 16 }}>
                  <LabeledInput
                    label={C.messageLabel}
                    value={message}
                    onChangeText={setMessage}
                    placeholder={placeholderFor(kind)}
                    multiline
                    maxLength={MAX_MESSAGE_LENGTH}
                    editable={!sending}
                    focusRing
                    autoCorrect
                    style={{
                      minHeight: 112,
                      maxHeight: 180,
                      fontSize: 14.5,
                      lineHeight: 21,
                      fontWeight: '400',
                      textAlignVertical: 'top',
                    }}
                  />
                  {counter ? (
                    <Text
                      style={{
                        fontSize: 12.5,
                        color: EX.color.inkMuted,
                        textAlign: 'right',
                        marginTop: 6,
                      }}
                    >
                      {counter}
                    </Text>
                  ) : null}
                </View>

                {/* Screenshot */}
                <View style={{ marginTop: 16 }}>
                  <ScreenshotCard
                    uri={screenshotUri}
                    captureFailed={captureFailed}
                    removed={removed}
                    locked={sending}
                    onRemove={() => setRemoved(true)}
                    onAddBack={() => setRemoved(false)}
                  />
                </View>

                {/* What we send */}
                <Text
                  style={{
                    fontSize: 12.5,
                    lineHeight: 18,
                    color: EX.color.inkMuted,
                    marginTop: 12,
                  }}
                >
                  {C.autoInfo}
                </Text>

                {/* Error, above the CTA */}
                {error ? (
                  <View style={{ marginTop: 16 }}>
                    <InlineError message={error} />
                  </View>
                ) : null}

                {/* Send CTA: 54px coral, 60% when it cannot be used */}
                <PressableStatic
                  onPress={onSend}
                  disabled={!ready || sending}
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: !ready || sending,
                    busy: sending,
                  }}
                  style={[
                    {
                      height: 54,
                      borderRadius: EX.radius.button,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      gap: 8,
                      backgroundColor: EX.color.primary,
                      opacity: !ready || sending ? 0.6 : 1,
                      marginTop: 16,
                    },
                    EXShadow.primaryBtn,
                  ]}
                >
                  {sending ? <ActivityIndicator color="#fff" /> : null}
                  <Text
                    style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}
                  >
                    {sendLabel}
                  </Text>
                </PressableStatic>

                <PressableStatic
                  onPress={requestClose}
                  disabled={sending}
                  accessibilityRole="button"
                  style={{
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: EX.color.inkMuted,
                    }}
                  >
                    {C.cancel}
                  </Text>
                </PressableStatic>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
