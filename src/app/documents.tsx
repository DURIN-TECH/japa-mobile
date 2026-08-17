// ─────────────────────────────────────────────────────────────────────────────
// My documents (profile → documents secondary destination).
//
// A flat document library across every application. Structure mirrors the other
// Explorer list screens (consultations.tsx / self-service DocRows):
//   • standard 40px back header at insets.top + 10
//   • a white summary strip with three live counts (Verified / In review / Missing)
//   • a row of filter chips (All / Verified / In review / Rejected / Missing)
//   • a list of white rows (radius 18) — status icon chip + name + meta line, and
//     on the right a status Pill, EXCEPT `missing` rows which show a coral Upload
//     button (matching the self-service DocRow treatment).
//
// Data + colours come from the static contract: `DOCUMENTS` and `DOC_STATUS`.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { DOCUMENTS, DOC_STATUS, type Doc } from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import { Pill } from '@/components/explorer/primitives';
import { fmtDate } from '@/components/explorer/liveDate';
import {
  useMyDocuments,
  useSharedDocuments,
  useGetDownloadUrl,
} from '@/hooks/useDocuments';
import { mapDocument } from '@/components/explorer/liveDocuments';

// Filter keys map 1:1 to Doc.status, plus the "all" catch-all. Labels rename
// `uploaded` → "In review" and `missing` → "Missing" for a friendlier UI.
type FilterKey = 'all' | Doc['status'];
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'verified', label: 'Verified' },
  { key: 'uploaded', label: 'In review' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'missing', label: 'Missing' },
];

// ── DocRow — one document in the library ─────────────────────────────────────
// 38px status icon chip (tinted from DOC_STATUS) + name (15/600) + meta line,
// then a status Pill on the right — or a coral Upload button when missing.
//
// `onOpen` is supplied only for LIVE documents that actually have a file behind
// them: tapping mints a signed URL and hands it to the system viewer. Demo rows
// and `missing` rows have nothing to open, so they stay inert rather than
// offering a tap that fails.
function DocRow({
  doc,
  onOpen,
  opening,
}: {
  doc: Doc;
  onOpen?: () => void;
  opening?: boolean;
}) {
  const s = DOC_STATUS[doc.status];
  const missing = doc.status === 'missing';
  // Missing rows fade the chip icon to the faint tone (matches self-service).
  const iconColor = missing ? EX.color.faint : s.fg;
  // Meta line: "{category} · {size or '—'} · {date}".
  const meta = `${doc.category} · ${doc.size ?? '—'} · ${doc.date}`;

  return (
    <Pressable
      onPress={onOpen}
      disabled={!onOpen || opening}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#fff',
        borderRadius: 18,
        borderWidth: 1,
        // Press feedback only where there is something to open.
        borderColor: onOpen && pressed ? EX.color.line12 : EX.color.line06,
        opacity: opening ? 0.6 : 1,
        paddingHorizontal: 13,
        paddingVertical: 13,
        shadowColor: '#171326',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      })}
    >
      {/* 38px status icon chip — bg from DOC_STATUS (missing → 0.05 ink tint) */}
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: missing ? 'rgba(23,19,38,0.05)' : s.bg,
        }}
      >
        {/* verified → check2 · uploaded → docs · rejected → x · missing → docs */}
        {doc.status === 'verified' ? (
          <Ic.check2 size={19} color={iconColor} strokeWidth={1.8} />
        ) : doc.status === 'rejected' ? (
          <Ic.x size={18} color={iconColor} strokeWidth={1.8} />
        ) : (
          <Ic.docs size={17} color={iconColor} strokeWidth={1.8} />
        )}
      </View>

      {/* Name + meta line */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontSize: 15, fontWeight: '600', color: EX.color.ink }}
          numberOfLines={1}
        >
          {doc.name}
        </Text>
        <Text
          style={{ fontSize: 12.5, color: EX.color.muted, marginTop: 2 }}
          numberOfLines={1}
        >
          {meta}
        </Text>
      </View>

      {/* Missing → coral Upload button; otherwise a status Pill */}
      {missing ? (
        <Pressable
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: EX.color.primary,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 9,
          }}
        >
          <Ic.upload size={15} color="#fff" strokeWidth={2} />
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
            Upload
          </Text>
        </Pressable>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pill label={s.label} fg={s.fg} bg={s.bg} small />
          {/* Affordance that the row opens the file — a list of names alone
              never let a client actually SEE what was filed for them. */}
          {onOpen ? (
            <Ic.chevR size={17} color={EX.color.faint} strokeWidth={1.8} />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

// ── SharedDocRow — one agency-authored document shared with the client ───────
// Visually a sibling of DocRow but semantically different: there is no review
// status to show (the client isn't submitting it), so the right side is just a
// chevron into the reader.
function SharedDocRow({
  title,
  by,
  at,
  onPress,
}: {
  title: string;
  by: string;
  at: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#fff',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: pressed ? EX.color.line12 : EX.color.line06,
        paddingHorizontal: 13,
        paddingVertical: 13,
        shadowColor: '#171326',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: EX.color.primaryTint10,
        }}
      >
        <Ic.docs size={17} color={EX.color.primary} strokeWidth={1.8} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontSize: 15, fontWeight: '600', color: EX.color.ink }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={{ fontSize: 12.5, color: EX.color.muted, marginTop: 2 }}
          numberOfLines={1}
        >
          {`Shared by ${by} · ${at}`}
        </Text>
      </View>

      <Ic.chevR size={17} color={EX.color.faint} strokeWidth={1.8} />
    </Pressable>
  );
}

// ── Summary count cell (one of three in the top strip) ───────────────────────
function CountCell({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
      <Text
        style={{
          fontSize: 22,
          fontWeight: '700',
          color,
          letterSpacing: -0.2,
        }}
      >
        {value}
      </Text>
      <Text
        style={{ fontSize: 11.5, color: EX.color.muted, fontWeight: '500' }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function DocumentsView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterKey>('all');

  // ── Live data (aggregated across the user's applications) ─────────────────
  // Fetch every document across the user's applications, then map each onto the
  // screen's `Doc` shape. Falls back to the demo library when the backend
  // returns nothing, so the screen is never blank.
  const { data: myDocs, isLoading } = useMyDocuments();
  const live = useMemo<Doc[]>(
    () => (myDocs ?? []).map(({ doc, app }) => mapDocument(doc, app)),
    [myDocs],
  );
  const docs = live.length ? live : DOCUMENTS;

  // Ids backed by a real backend document. Only these can be opened — the demo
  // fallback rows have no file behind them, and asking the API for one would
  // 404. Recomputed with the live list so it can never drift from it.
  const liveIds = useMemo(() => new Set(live.map((d) => d.id)), [live]);

  // ── Documents the agency shared with this client ──────────────────────────
  // Rich-text documents an agent wrote and shared (cover letters, SOPs), as
  // opposed to the uploaded files above. Fetched across every application.
  const { data: sharedDocs } = useSharedDocuments();
  const shared = sharedDocs ?? [];

  // ── Opening an uploaded file ──────────────────────────────────────────────
  // The signed URL is minted per tap rather than up front: these expire quickly,
  // so one fetched at screen load would usually be dead by the time it's used.
  const getDownloadUrl = useGetDownloadUrl();
  const [openingId, setOpeningId] = useState<string | null>(null);

  async function openDocument(documentId: string) {
    if (openingId) return;
    setOpeningId(documentId);
    try {
      const url = await getDownloadUrl.mutateAsync(documentId);
      if (!url) throw new Error('No download URL');
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Couldn't open document",
        'Please check your connection and try again.',
      );
    } finally {
      setOpeningId(null);
    }
  }

  // ── Live counts across the whole library ──────────────────────────────────
  const verified = docs.filter((d) => d.status === 'verified').length;
  const inReview = docs.filter((d) => d.status === 'uploaded').length;
  const missing = docs.filter((d) => d.status === 'missing').length;

  // Filtered list for the active chip.
  const list = docs.filter((d) => filter === 'all' || d.status === filter);

  // While the aggregate query is still loading (and no live rows have arrived
  // yet), show a centered spinner rather than flashing the demo fallback.
  if (isLoading && !live.length) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: EX.color.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={EX.color.primary} />
      </View>
    );
  }

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
          <View>
            <Text style={displayText(24, 'semibold')}>My documents</Text>
            <Text
              style={{ fontSize: 12.5, color: EX.color.muted, marginTop: 2 }}
            >
              {docs.length} documents across your applications
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── Summary strip: Verified / In review / Missing ─────────────────── */}
        <View style={{ paddingHorizontal: 22, paddingTop: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#fff',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: EX.color.line06,
              paddingVertical: 16,
              shadowColor: '#171326',
              shadowOpacity: 0.04,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
          >
            <CountCell
              value={verified}
              label="Verified"
              color={EX.color.success}
            />
            <View
              style={{ width: 1, height: 34, backgroundColor: EX.color.line08 }}
            />
            <CountCell value={inReview} label="In review" color="#2F62A0" />
            <View
              style={{ width: 1, height: 34, backgroundColor: EX.color.line08 }}
            />
            <CountCell value={missing} label="Missing" color={EX.color.muted} />
          </View>
        </View>

        {/* ── Filter chips ──────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: 8,
            paddingHorizontal: 22,
            paddingTop: 16,
            paddingBottom: 4,
          }}
          style={{ flexGrow: 0 }}
        >
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={{
                  borderWidth: 1,
                  borderColor: on ? EX.color.ink : EX.color.line12,
                  backgroundColor: on ? EX.color.ink : '#fff',
                  borderRadius: 999,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: on ? '#FBF7F0' : EX.color.inkMuted,
                  }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── Document list / empty state ───────────────────────────────────── */}
        <View
          style={{
            paddingHorizontal: 22,
            paddingTop: 10,
            gap: 10,
          }}
        >
          {list.length === 0 ? (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 48,
                gap: 12,
              }}
            >
              <Ic.docs
                size={38}
                color={EX.color.muted}
                strokeWidth={1.8}
                style={{ opacity: 0.5 }}
              />
              <Text style={{ fontSize: 14, color: EX.color.muted }}>
                No documents here
              </Text>
            </View>
          ) : (
            list.map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                // Openable only when there's a real file: a live document that
                // isn't still awaiting upload.
                onOpen={
                  liveIds.has(doc.id) && doc.status !== 'missing'
                    ? () => void openDocument(doc.id)
                    : undefined
                }
                opening={openingId === doc.id}
              />
            ))
          )}
        </View>

        {/* ── Shared with you ───────────────────────────────────────────────
            Documents the agency prepared and shared. Hidden entirely when
            there are none, so the screen is unchanged for clients whose
            agency doesn't use the feature. */}
        {shared.length > 0 ? (
          <View style={{ paddingHorizontal: 22, paddingTop: 26, gap: 10 }}>
            <View style={{ gap: 2 }}>
              <Text style={displayText(18, 'semibold')}>Shared with you</Text>
              <Text style={{ fontSize: 12.5, color: EX.color.muted }}>
                {shared.length === 1
                  ? '1 document from your agency'
                  : `${shared.length} documents from your agency`}
              </Text>
            </View>

            {shared.map((doc) => (
              <SharedDocRow
                key={doc.id}
                title={doc.title}
                by={doc.createdByName ?? 'your agent'}
                at={fmtDate(doc.updatedAt, 'MMM d', '—')}
                onPress={() => router.push(`/shared-document/${doc.id}`)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
