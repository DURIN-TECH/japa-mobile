// ─────────────────────────────────────────────────────────────────────────────
// Book a consultation (prototype booking flow — step 1 of 3).
//
// A single scrollable form (wrapped in KeyboardAvoidingView because of the Notes
// input) that collects: date (14-day chip strip) · time (17 half-hour slots) ·
// topic · mode (video/phone) · duration (30/45) · optional notes. A sticky glass
// CTA at the base shows the total and a coral "Continue" that is disabled until a
// date + time + topic are chosen, then pushes → /(explorer)/pay with the booking
// param contract.
//
// Design system: coral/cream Explorer tokens (EX), Space Grotesk display font.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDays, addMinutes, format, setHours, setMinutes } from 'date-fns';
import { EX, displayText } from '@/components/explorer/theme';
import { NAIRA, agentById, CONSULT_TOPICS } from '@/components/explorer/data';
import { mapAgent } from '@/components/explorer/liveAgents';
import { useAgent } from '@/hooks/useAgents';
import { Ic } from '@/components/explorer/icons';
import { Portrait, Verified } from '@/components/explorer/primitives';

// Lucide-style icon component signature (size/color/strokeWidth props).
type IconType = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

// Booking modes + durations — string literals match the nav param contract.
type Mode = 'Video call' | 'Phone call';
type Duration = '30 min' | '45 min';

// ── SectionLabel — form section heading (18/700, matches detail screens) ──────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 16.5,
        fontWeight: '700',
        color: EX.color.ink,
        letterSpacing: -0.18,
        marginBottom: 12,
      }}
    >
      {children}
    </Text>
  );
}

// ── SegmentedItem — one half of a two-option segmented control ────────────────
// Selected = coral fill + white text; idle = transparent + inkMuted text.
function SegmentedItem({
  icon: IconCmp,
  label,
  active,
  onPress,
}: {
  icon?: IconType;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        height: 46,
        borderRadius: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        backgroundColor: active ? EX.color.primary : 'transparent',
        // Coral glow when active (matches primary CTA treatment).
        shadowColor: EX.color.primary,
        shadowOpacity: active ? 0.35 : 0,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: active ? 4 : 0,
      }}
    >
      {IconCmp ? (
        <IconCmp
          size={17}
          color={active ? '#fff' : EX.color.inkMuted}
          strokeWidth={1.8}
        />
      ) : null}
      <Text
        style={{
          fontSize: 13.5,
          fontWeight: '700',
          color: active ? '#fff' : EX.color.inkMuted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Segmented — cream track wrapping two SegmentedItems ───────────────────────
function Segmented({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 5,
        padding: 5,
        borderRadius: 16,
        backgroundColor: EX.color.cream,
        borderWidth: 1,
        borderColor: EX.color.line08,
      }}
    >
      {children}
    </View>
  );
}

export default function BookConsultation() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { agentId } = useLocalSearchParams<{ agentId: string }>();
  // Demo agents resolve from static AGENTS; live agents fetch GET /agents/:id.
  const demo = agentById(agentId);
  const liveQ = useAgent(demo ? undefined : agentId);
  const a = demo ?? (liveQ.data ? mapAgent(liveQ.data) : undefined);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('Video call');
  const [dur, setDur] = useState<Duration>('30 min'); // default 30 min
  const [notes, setNotes] = useState('');

  // Next 14 days as selectable date chips.
  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)),
    [],
  );

  // 17 half-hour time slots from 9:00 AM → 5:00 PM as 12-hour display strings.
  const slots = useMemo(() => {
    const base = setMinutes(setHours(new Date(), 9), 0); // 9:00 AM today
    return Array.from({ length: 17 }, (_, i) =>
      format(addMinutes(base, i * 30), 'h:mm a'),
    );
  }, []);

  if (!demo && liveQ.isLoading) {
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

  if (!a) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: EX.color.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: EX.color.muted }}>Agent not found.</Text>
      </View>
    );
  }

  // Continue is enabled only once a date + time + topic are all chosen.
  const canContinue = !!(date && time && topic);

  const onContinue = () => {
    if (!date || !time || !topic) return;
    router.push({
      pathname: '/(explorer)/pay',
      params: {
        agentId: a.id,
        dateIso: format(date, 'yyyy-MM-dd'),
        time,
        topic,
        mode,
        dur,
        fee: String(a.fee),
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: EX.color.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: EX.space.ctaClear }}
      >
        {/* ── Back header — title + "with {agent}" subtitle ─────────────────── */}
        <View
          style={{
            paddingTop: insets.top + 10,
            paddingHorizontal: 18,
            paddingBottom: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
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
            <Text style={displayText(24, 'semibold')}>Book consultation</Text>
            <Text
              style={{ fontSize: 12.5, color: EX.color.muted, marginTop: 2 }}
            >
              with {a.n}
            </Text>
          </View>
        </View>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: EX.space.screenX, paddingTop: 14 }}>
          {/* Agent mini-card: portrait + name/verified/spec + cream info strip */}
          <View
            style={{
              backgroundColor: EX.color.cardWhite,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: EX.color.line08,
              padding: 14,
              shadowColor: '#171326',
              shadowOpacity: 0.04,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <Portrait seed={a.seed} size={46} name={a.n} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: EX.color.ink,
                    }}
                    numberOfLines={1}
                  >
                    {a.n}
                  </Text>
                  <Verified size={14} />
                </View>
                <Text
                  style={{
                    fontSize: 12.5,
                    color: EX.color.muted,
                    marginTop: 1,
                  }}
                  numberOfLines={1}
                >
                  {a.spec}
                </Text>
              </View>
            </View>

            {/* Cream info strip: "{duration} · {fee}". */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: EX.color.cream,
                borderRadius: 13,
                paddingHorizontal: 13,
                paddingVertical: 11,
                marginTop: 13,
              }}
            >
              <Ic.clock size={14} color={EX.color.inkMuted} strokeWidth={1.8} />
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: '600',
                  color: EX.color.inkMuted,
                }}
              >
                {dur} · {NAIRA(a.fee)}
              </Text>
            </View>
          </View>

          {/* ── Select date — horizontal 14-day chip strip ─────────────────── */}
          <View style={{ marginTop: 24 }}>
            <SectionLabel>Select date</SectionLabel>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 9, paddingRight: 4 }}
          >
            {days.map((d) => {
              const on =
                date != null &&
                format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
              return (
                <Pressable
                  key={d.toISOString()}
                  onPress={() => setDate(d)}
                  style={{
                    width: 56,
                    paddingVertical: 12,
                    borderRadius: 16,
                    alignItems: 'center',
                    gap: 3,
                    backgroundColor: on ? EX.color.primary : '#fff',
                    borderWidth: 1,
                    borderColor: on ? EX.color.primary : EX.color.line10,
                    shadowColor: EX.color.primary,
                    shadowOpacity: on ? 0.35 : 0,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: on ? 4 : 0,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '600',
                      color: on ? 'rgba(255,255,255,0.85)' : EX.color.muted,
                    }}
                  >
                    {format(d, 'EEE')}
                  </Text>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '700',
                      color: on ? '#fff' : EX.color.ink,
                      letterSpacing: -0.2,
                    }}
                  >
                    {format(d, 'd')}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* ── Select time — wrapped pill grid of 17 slots ────────────────── */}
          <View style={{ marginTop: 24 }}>
            <SectionLabel>Select time</SectionLabel>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
            {slots.map((s) => {
              const on = time === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setTime(s)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: on ? EX.color.primary : '#fff',
                    borderWidth: 1,
                    borderColor: on ? EX.color.primary : EX.color.line10,
                    shadowColor: EX.color.primary,
                    shadowOpacity: on ? 0.35 : 0,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: on ? 4 : 0,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: on ? '#fff' : EX.color.inkMuted,
                    }}
                  >
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Topic — single-select chip list ────────────────────────────── */}
          <View style={{ marginTop: 24 }}>
            <SectionLabel>Topic</SectionLabel>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
            {CONSULT_TOPICS.map((t) => {
              const on = topic === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setTopic(t)}
                  style={{
                    paddingHorizontal: 15,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: on ? EX.color.primary : EX.color.cream,
                    borderWidth: 1,
                    borderColor: on ? EX.color.primary : EX.color.line08,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: '600',
                      color: on ? '#fff' : EX.color.ink2,
                    }}
                  >
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Mode — segmented Video / Phone ─────────────────────────────── */}
          <View style={{ marginTop: 24 }}>
            <SectionLabel>Mode</SectionLabel>
          </View>
          <Segmented>
            <SegmentedItem
              icon={Ic.video}
              label="Video call"
              active={mode === 'Video call'}
              onPress={() => setMode('Video call')}
            />
            <SegmentedItem
              icon={Ic.phone}
              label="Phone call"
              active={mode === 'Phone call'}
              onPress={() => setMode('Phone call')}
            />
          </Segmented>

          {/* ── Duration — segmented 30 / 45 (default 30) ──────────────────── */}
          <View style={{ marginTop: 24 }}>
            <SectionLabel>Duration</SectionLabel>
          </View>
          <Segmented>
            <SegmentedItem
              label="30 min"
              active={dur === '30 min'}
              onPress={() => setDur('30 min')}
            />
            <SegmentedItem
              label="45 min"
              active={dur === '45 min'}
              onPress={() => setDur('45 min')}
            />
          </Segmented>

          {/* ── Notes (optional) — multiline TextInput card ────────────────── */}
          <View style={{ marginTop: 24 }}>
            <SectionLabel>Notes (optional)</SectionLabel>
          </View>
          <View
            style={{
              backgroundColor: EX.color.cardWhite,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: EX.color.line10,
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything the agent should know?"
              placeholderTextColor={EX.color.muted}
              multiline
              maxLength={500}
              textAlignVertical="top"
              style={{
                minHeight: 92,
                fontSize: 14.5,
                lineHeight: 21,
                color: EX.color.ink,
                padding: 0,
              }}
            />
          </View>
        </View>
      </ScrollView>

      {/* ── Sticky glass CTA — total + coral Continue ─────────────────────── */}
      <BlurView
        intensity={30}
        tint="light"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: 15,
          paddingHorizontal: EX.space.screenX,
          paddingBottom: Math.max(insets.bottom, 16) + 6,
          backgroundColor: EX.color.glassWarmSoft,
          borderTopWidth: 1,
          borderTopColor: EX.color.line06,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Total (natural width) */}
          <View>
            <Text
              style={{
                fontSize: 11.5,
                color: EX.color.muted,
                fontWeight: '500',
              }}
            >
              Total
            </Text>
            <Text
              style={{
                fontSize: 20,
                fontWeight: '700',
                color: EX.color.ink,
                letterSpacing: -0.2,
                lineHeight: 22,
              }}
            >
              {NAIRA(a.fee)}
            </Text>
          </View>

          {/* Continue (coral, flex 1, disabled until date+time+topic) */}
          <Pressable
            onPress={onContinue}
            disabled={!canContinue}
            style={{
              flex: 1,
              height: 54,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: canContinue
                ? EX.color.primary
                : 'rgba(244,81,108,0.35)',
              shadowColor: EX.color.primary,
              shadowOpacity: canContinue ? 0.45 : 0,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 10 },
              elevation: canContinue ? 6 : 0,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
              Continue
            </Text>
            <Ic.arrow size={18} color="#fff" strokeWidth={1.8} />
          </Pressable>
        </View>
      </BlurView>
    </KeyboardAvoidingView>
  );
}
