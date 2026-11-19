// ─────────────────────────────────────────────────────────────────────────────
// Shared document reader.
//
// Opens one document an agency prepared and shared with this client — a cover
// letter, statement of purpose, affidavit. Sharing has always been a switch the
// agent could flip in the portal; until now the client had no screen that could
// show the result.
//
// Layout matches the other secondary Explorer destinations: 40px back header at
// insets.top + 10, then the document body on a white card.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { ProseMirrorText } from '@/components/explorer/ProseMirrorText';
import { fmtDate } from '@/components/explorer/liveDate';
import { useSharedDocument } from '@/hooks/useDocuments';

export default function SharedDocumentView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: document, isLoading, isError } = useSharedDocument(id ?? '');

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* ── Back header ─────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 18,
          paddingBottom: 6,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: EX.color.line10,
              backgroundColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ic.chevL size={21} color={EX.color.ink} strokeWidth={1.8} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={displayText(20, 'semibold')} numberOfLines={2}>
              {document?.title ?? 'Document'}
            </Text>
            {document ? (
              <Text
                style={{ fontSize: 12.5, color: EX.color.muted, marginTop: 2 }}
                numberOfLines={1}
              >
                Shared by {document.createdByName ?? 'your agent'} ·{' '}
                {fmtDate(document.updatedAt, 'MMM d', '—')}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {isLoading ? (
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator color={EX.color.primary} />
        </View>
      ) : isError || !document ? (
        // A 404 here is the expected outcome when the agency un-shares a
        // document between the list loading and this screen opening, so the
        // copy says that rather than reporting a generic failure.
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 40,
            gap: 12,
          }}
        >
          <Ic.docs
            size={38}
            color={EX.color.muted}
            strokeWidth={1.8}
            style={{ opacity: 0.5 }}
          />
          <Text
            style={{ fontSize: 14, color: EX.color.muted, textAlign: 'center' }}
          >
            This document isn&apos;t available any more. Your agent may have
            unshared it.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingTop: 12,
            paddingBottom: 40,
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: EX.color.line06,
              padding: 18,
              shadowColor: '#171326',
              shadowOpacity: 0.04,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
          >
            <ProseMirrorText content={document.content} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}
