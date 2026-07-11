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

import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { DOCUMENTS, DOC_STATUS, type Doc } from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import { Pill } from '@/components/explorer/primitives';

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
function DocRow({ doc }: { doc: Doc }) {
  const s = DOC_STATUS[doc.status];
  const missing = doc.status === 'missing';
  // Missing rows fade the chip icon to the faint tone (matches self-service).
  const iconColor = missing ? EX.color.faint : s.fg;
  // Meta line: "{category} · {size or '—'} · {date}".
  const meta = `${doc.category} · ${doc.size ?? '—'} · ${doc.date}`;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#fff',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: EX.color.line06,
        paddingHorizontal: 13,
        paddingVertical: 13,
        shadowColor: '#171326',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
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
        <Pill label={s.label} fg={s.fg} bg={s.bg} small />
      )}
    </View>
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

  // ── Live counts across the whole library ──────────────────────────────────
  const verified = DOCUMENTS.filter((d) => d.status === 'verified').length;
  const inReview = DOCUMENTS.filter((d) => d.status === 'uploaded').length;
  const missing = DOCUMENTS.filter((d) => d.status === 'missing').length;

  // Filtered list for the active chip.
  const list = DOCUMENTS.filter(
    (d) => filter === 'all' || d.status === filter,
  );

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
            <Text style={{ fontSize: 12.5, color: EX.color.muted, marginTop: 2 }}>
              {DOCUMENTS.length} documents across your applications
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
            <CountCell value={verified} label="Verified" color={EX.color.success} />
            <View style={{ width: 1, height: 34, backgroundColor: EX.color.line08 }} />
            <CountCell value={inReview} label="In review" color="#2F62A0" />
            <View style={{ width: 1, height: 34, backgroundColor: EX.color.line08 }} />
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
            list.map((doc) => <DocRow key={doc.id} doc={doc} />)
          )}
        </View>
      </ScrollView>
    </View>
  );
}
