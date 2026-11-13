// ─────────────────────────────────────────────────────────────────────────────
// One-time AI notice (issue #172): a slide-up sheet over the chat thread, same
// pattern as the "Shared files" sheet in messages/[id].tsx.
//
// Shown only to people whose plan includes AI but who have not approved it, and
// who have not dismissed it (decided by `shouldShowNotice`). "Got it", the scrim
// and the system back gesture all close it and record the dismissal on the
// server. If recording fails the sheet still closes and nothing is shown; the
// server still says "not dismissed", so it retries on the next chat open.
//
// DRAFT wording: the title and paragraphs come from the server
// (`state.noticeWording`); only the note line and button are client copy.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, EXShadow } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { IconChip } from '@/components/explorer/primitives';
import { CoralSubmit } from '@/components/explorer/AccountForm';
import {
  AiAccessRows,
  type AiAccessControl,
} from '@/components/explorer/AiAccessBar';
import { AI_COPY } from '@/components/explorer/aiMessageAccessLogic';
import type { AiWording } from '@/types/ai-message-access.type';

export function AiNoticeSheet({
  visible,
  wording,
  control,
  onClose,
  onOpenSettings,
}: {
  visible: boolean;
  wording: AiWording;
  /** The same chat-switch control the bar uses, acting on this chat. */
  control: AiAccessControl;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      // Android back / iOS swipe-down dismissal both land here.
      onRequestClose={onClose}
    >
      {/* Scrim: tapping it closes the sheet. */}
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(23,19,38,0.35)',
        }}
      >
        {/* Stop taps inside the sheet from closing it. */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            {
              backgroundColor: EX.color.bg,
              borderTopLeftRadius: EX.radius.sheet,
              borderTopRightRadius: EX.radius.sheet,
              paddingTop: 20,
              paddingHorizontal: 20,
              paddingBottom: Math.max(insets.bottom, 22),
              maxHeight: '88%',
            },
            EXShadow.hero,
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 14 }}
          >
            {/* Icon + title */}
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <IconChip icon={Ic.spark} size={38} radius={12} iconSize={18} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 18,
                  fontWeight: '700',
                  color: EX.color.ink,
                  letterSpacing: -0.18,
                }}
              >
                {wording.title}
              </Text>
            </View>

            {/* Server wording, paragraph by paragraph */}
            {wording.paragraphs.map((p, i) => (
              <Text
                key={i}
                style={{ fontSize: 14.5, lineHeight: 21, color: EX.color.ink2 }}
              >
                {p}
              </Text>
            ))}

            {/* The switch row: the bar's states, acting on this chat */}
            <View
              style={{
                backgroundColor: EX.color.cardWhite,
                borderRadius: EX.radius.card,
                borderWidth: 1,
                borderColor: EX.color.line06,
                padding: 15,
              }}
            >
              <AiAccessRows control={control} onOpenSettings={onOpenSettings} />
            </View>

            <Text
              style={{ fontSize: 13, lineHeight: 19, color: EX.color.inkMuted }}
            >
              {AI_COPY.noticeNote}
            </Text>
          </ScrollView>

          <View style={{ marginTop: 14 }}>
            <CoralSubmit label={AI_COPY.noticeButton} onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
