// ─────────────────────────────────────────────────────────────────────────────
// Self-service flow (prototype flows.jsx SelfServiceView).
//
// A DIY visa-application checklist. Mirrors the destination-detail pattern:
// a short parallax photo hero (210) with a rounded content sheet rising over it
// and a sticky dark CTA. The sheet holds an application-progress card, the two
// numbered steps (official portal + document upload) and per-requirement cards
// with individual DocRows.
//
// Every measurement below is quoted from the prototype (flows.jsx). Data comes
// from the static contract: `SS`, `DOC_STATUS` and `destById(SS.destId)`.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import {
  SS,
  DOC_STATUS,
  destById,
  type SSDoc,
  type SSReq,
} from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import {
  Flag,
  GlassButton,
  Pill,
  Progress,
  SectionTitle,
} from '@/components/explorer/primitives';

// Hero height for this flow — shorter than the destination detail (376) so the
// checklist content dominates the screen (prototype: `const HERO = 210`).
const HERO = 210;

// ── DocRow — a single uploadable document inside a requirement card ───────────
// Prototype: 34px status chip, 14/600 name, 12 file-or-label, missing→coral
// Upload button (radius 12) else a status Pill, with a rejected reason band.
function DocRow({ doc, first }: { doc: SSDoc; first: boolean }) {
  const s = DOC_STATUS[doc.status];
  const missing = doc.status === 'missing';
  const rejected = doc.status === 'rejected';
  // Prototype colours: missing rows fade the chip icon to #A39FB0.
  const iconColor = missing ? '#A39FB0' : s.fg;

  return (
    <View
      style={{ borderTopWidth: first ? 0 : 1, borderTopColor: EX.color.line06 }}
    >
      {/* Main row: status icon · name/file · action (Upload button or status Pill) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 13,
        }}
      >
        {/* Status icon chip — 34px, bg/fg from DOC_STATUS (missing uses 0.05 tint) */}
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: missing ? 'rgba(23,19,38,0.05)' : s.bg,
          }}
        >
          {/* verified → check2 (19) · rejected → x (17) · else → docs (17) */}
          {doc.status === 'verified' ? (
            <Ic.check2 size={19} color={iconColor} strokeWidth={1.8} />
          ) : rejected ? (
            <Ic.x size={17} color={iconColor} strokeWidth={1.8} />
          ) : (
            <Ic.docs size={17} color={iconColor} strokeWidth={1.8} />
          )}
        </View>

        {/* Name + filename (or the status label when there is no file) */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{ fontSize: 14, fontWeight: '600', color: EX.color.ink }}
            numberOfLines={1}
          >
            {doc.name}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: missing ? EX.color.muted : s.fg,
              marginTop: 1,
            }}
            numberOfLines={1}
          >
            {doc.file ?? s.label}
          </Text>
        </View>

        {/* Missing → coral Upload button (radius 12); otherwise a status Pill */}
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

      {/* Rejected → indented red reason band + plain-text Re-upload link */}
      {doc.reason ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            marginTop: 8,
            marginLeft: 46,
            paddingVertical: 8,
            paddingHorizontal: 11,
            borderRadius: 10,
            backgroundColor: '#FBE3E1',
          }}
        >
          <Ic.help size={14} color="#C0453C" strokeWidth={1.8} />
          <Text
            style={{
              flex: 1,
              fontSize: 12,
              lineHeight: 16.5,
              color: '#9E3630',
              fontWeight: '600',
            }}
          >
            {doc.reason}
          </Text>
          <Pressable hitSlop={6}>
            <Text style={{ color: '#C0453C', fontSize: 12, fontWeight: '700' }}>
              Re-upload
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// ── Requirement card — a grouped set of documents ────────────────────────────
// Prototype: radius 20, padding 15/16, 22px done-check circle, 15.5/700 title,
// clock+est 12, full-width description, then the DocRow list.
function RequirementCard({ req }: { req: SSReq }) {
  // A requirement is "done" only when every document within it is verified or
  // uploaded (prototype: `r.docs.every(x => verified || uploaded)`).
  const done = req.docs.every(
    (d) => d.status === 'verified' || d.status === 'uploaded',
  );

  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: EX.radius.card, // 20
        borderWidth: 1,
        borderColor: 'rgba(23,19,38,0.07)',
        paddingHorizontal: 16,
        paddingVertical: 15,
        marginBottom: 13,
        shadowColor: '#171326',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      {/* Header: done-check (22px) · title · est (clock) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: done ? '#D6F2E2' : 'rgba(23,19,38,0.06)',
          }}
        >
          {done ? (
            <Ic.check size={12} color="#1E8E55" strokeWidth={3.4} />
          ) : null}
        </View>
        <Text
          style={{
            flex: 1,
            fontSize: 15.5,
            fontWeight: '700',
            color: EX.color.ink,
          }}
          numberOfLines={1}
        >
          {req.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ic.clock size={13} color={EX.color.muted} strokeWidth={1.8} />
          <Text
            style={{ fontSize: 12, color: EX.color.muted, fontWeight: '600' }}
          >
            {req.est}
          </Text>
        </View>
      </View>

      {/* Description — full width (prototype has no left indent) */}
      <Text
        style={{
          fontSize: 13,
          lineHeight: 19,
          color: EX.color.inkMuted,
          marginTop: 8,
          marginBottom: 2,
        }}
      >
        {req.desc}
      </Text>

      {/* Documents */}
      <View style={{ marginTop: 6 }}>
        {req.docs.map((doc, i) => (
          <DocRow key={doc.name} doc={doc} first={i === 0} />
        ))}
      </View>
    </View>
  );
}

export default function SelfServiceView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const d = destById(SS.destId);

  // Parallax driven by the sheet's scroll offset. The prototype translated the
  // hero at `py * -0.3` (no image zoom) — matched exactly here.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scrollY.value * -0.3 }],
  }));

  // ── Progress counts, computed across every document in every requirement ────
  // Prototype: uploaded = non-missing, verified = verified, required = total.
  const allDocs = SS.requirements.flatMap((r) => r.docs);
  const uploaded = allDocs.filter((doc) => doc.status !== 'missing').length;
  const verified = allDocs.filter((doc) => doc.status === 'verified').length;
  const required = allDocs.length;
  const pct = Math.round(SS.progress * 100);

  if (!d) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: EX.color.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: EX.color.muted }}>Application not found.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* HERO — fixed behind, parallaxes as the sheet scrolls over it */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: HERO,
            overflow: 'hidden',
            backgroundColor: d.tone,
          },
          heroStyle,
        ]}
      >
        <Image
          source={{ uri: d.img }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          contentFit="cover"
          transition={200}
        />
        {/* Scrim — prototype: .82 → .2 @55% → .34, bottom→top */}
        <LinearGradient
          colors={[
            'rgba(12,10,8,0.82)',
            'rgba(12,10,8,0.2)',
            'rgba(12,10,8,0.34)',
          ]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />

        {/* Bottom hero content: glass "Self-service" badge · flag+country·ref · visa */}
        <View style={{ position: 'absolute', left: 22, right: 22, bottom: 42 }}>
          <BlurView
            intensity={20}
            tint="light"
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderRadius: 999,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.26)',
              backgroundColor: 'rgba(255,255,255,0.16)',
              paddingHorizontal: 11,
              paddingVertical: 5,
              marginBottom: 8,
            }}
          >
            <Ic.docs size={13} color="#fff" strokeWidth={2} />
            <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '700' }}>
              Self-service
            </Text>
          </BlurView>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Flag code={d.flag} size={18} radius={5} />
            <Text
              style={{
                color: '#fff',
                fontSize: 12.5,
                fontWeight: '600',
                opacity: 0.95,
              }}
            >
              {d.country} · Ref {SS.ref}
            </Text>
          </View>
          <Text
            style={{
              color: '#fff',
              fontFamily: EX.font.display.semibold,
              fontSize: 26,
              lineHeight: 28,
              letterSpacing: -0.26,
              textShadowColor: 'rgba(0,0,0,0.3)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 14,
            }}
          >
            {d.visa}
          </Text>
        </View>
      </Animated.View>

      {/* Top glass back control (prototype top:54 → safe-area inset + 6) */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 6,
          left: 18,
          zIndex: 50,
        }}
      >
        <GlassButton icon={Ic.chevL} onPress={() => router.back()} />
      </View>

      {/* Scrolling content sheet */}
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Spacer revealing the hero (sheet overlaps ~26px) */}
        <View style={{ height: HERO - 26 }} pointerEvents="none" />

        <View
          style={{
            backgroundColor: EX.color.bg,
            borderTopLeftRadius: EX.radius.sheet, // 28
            borderTopRightRadius: EX.radius.sheet,
            minHeight: 620,
            paddingTop: 20,
            paddingHorizontal: 22,
            paddingBottom: EX.space.ctaClear, // 130
            shadowColor: '#171326',
            shadowOpacity: 0.26,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: -8 },
          }}
        >
          {/* ── Progress card (radius 22, padding 18) ───────────────────────── */}
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 22,
              borderWidth: 1,
              borderColor: 'rgba(23,19,38,0.07)',
              padding: 18,
              shadowColor: '#171326',
              shadowOpacity: 0.04,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: '700', color: EX.color.ink }}
              >
                Application progress
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: EX.color.primary,
                }}
              >
                {pct}%
              </Text>
            </View>
            <Progress value={SS.progress} height={7} />

            {/* 3 counts with dividers: Uploaded · Verified (green) · Required */}
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: EX.color.ink,
                    letterSpacing: -0.2,
                  }}
                >
                  {uploaded}
                </Text>
                <Text
                  style={{
                    fontSize: 11.5,
                    color: EX.color.muted,
                    fontWeight: '500',
                  }}
                >
                  Uploaded
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: EX.color.line08 }} />
              <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: EX.color.success,
                    letterSpacing: -0.2,
                  }}
                >
                  {verified}
                </Text>
                <Text
                  style={{
                    fontSize: 11.5,
                    color: EX.color.muted,
                    fontWeight: '500',
                  }}
                >
                  Verified
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: EX.color.line08 }} />
              <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: EX.color.ink,
                    letterSpacing: -0.2,
                  }}
                >
                  {required}
                </Text>
                <Text
                  style={{
                    fontSize: 11.5,
                    color: EX.color.muted,
                    fontWeight: '500',
                  }}
                >
                  Required
                </Text>
              </View>
            </View>
          </View>

          {/* ── Step 1 · Official application ───────────────────────────────── */}
          <SectionTitle>Step 1 · Official application</SectionTitle>
          <View
            style={{
              backgroundColor: EX.color.cream, // #FFF6EC
              borderRadius: EX.radius.card, // 20
              borderWidth: 1,
              borderColor: 'rgba(178,106,20,0.2)',
              padding: 16,
            }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#FCEAC8',
                }}
              >
                <Ic.docs size={20} color={EX.color.amber} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{ fontSize: 15, fontWeight: '700', color: '#7A5A2E' }}
                >
                  Complete the online form
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    lineHeight: 19,
                    color: '#8A6A38',
                    marginTop: 2,
                  }}
                >
                  Fill in your application on the official government portal
                  before uploading documents here.
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => Linking.openURL(`https://${SS.officialUrl}`)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                backgroundColor: EX.color.amber, // #B26A14
                borderRadius: 13,
                height: 46,
                marginTop: 14,
              }}
            >
              <Ic.arrowUR size={17} color="#fff" strokeWidth={2} />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                Open {SS.officialUrl}
              </Text>
            </Pressable>
          </View>

          {/* ── Step 2 · Upload documents ───────────────────────────────────── */}
          <SectionTitle>Step 2 · Upload documents</SectionTitle>
          {SS.requirements.map((req) => (
            <RequirementCard key={req.id} req={req} />
          ))}
        </View>
      </Animated.ScrollView>

      {/* ── Sticky dark CTA (prototype glass bar → BlurView) ─────────────────── */}
      <BlurView
        intensity={30}
        tint="light"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: 15,
          paddingHorizontal: 22,
          paddingBottom: Math.max(insets.bottom, 16) + 6,
          backgroundColor: EX.color.glassWarm,
          borderTopWidth: 1,
          borderTopColor: EX.color.line06,
        }}
      >
        <Pressable
          style={{
            height: 54,
            borderRadius: EX.radius.button, // 16
            backgroundColor: EX.color.ink,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            shadowColor: '#171326',
            shadowOpacity: 0.5,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 14 },
            elevation: 8,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
            Submit application
          </Text>
          <Ic.arrow size={18} color="#fff" strokeWidth={1.8} />
        </Pressable>
      </BlurView>
    </View>
  );
}
