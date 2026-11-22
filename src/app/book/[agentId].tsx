// ─────────────────────────────────────────────────────────────────────────────
// Book a consultation (prototype booking flow — step 1 of 3).
//
// A single scrollable form (wrapped in KeyboardAvoidingView because of the Notes
// input) that collects: date (14-day chip strip) · time (17 half-hour slots) ·
// topic · mode (video/phone) · duration (30/45) · optional notes. A sticky glass
// CTA at the base shows the total and a coral "Continue" that is disabled until a
// date + time + topic are chosen, then pushes → /pay with the booking
// param contract.
//
// japa#472: times that have already started today are shown disabled and
// cannot be picked (the backend refuses them anyway with SLOT_IN_PAST). The
// rules live in `src/hooks/bookingSlots.ts` (pure, unit-tested); this screen
// keeps a `now` that ticks every 30 seconds and refreshes on focus, and
// drops a pick that has gone into the past.
//
// Design system: coral/cream Explorer tokens (EX), Space Grotesk display font.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
// japa#472: which days and times can still be booked, on the device clock.
import {
  bookingDays,
  noSlotsLeft,
  slotOptions,
  validSelection,
} from '@/hooks/bookingSlots';
import { EX, displayText } from '@/components/explorer/theme';
import {
  CONSULT_TOPICS,
  localUnavailableNote,
  priceInline,
  priceParts,
} from '@/components/explorer/content';
import { PriceBlock } from '@/components/explorer/PriceBlock';
import { CenteredState } from '@/components/explorer/CenteredState';
import { isNotFoundError } from '@/hooks/queryErrors';
import { loadErrorCopy } from '@/components/explorer/states';
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

// japa#472: how often the picker re-reads the clock (a slot's pill turns
// disabled within 30 seconds of its start).
const NOW_TICK_MS = 30_000;

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
  // The agent from GET /agents/:id (japa#145: no demo AGENTS lookup).
  const liveQ = useAgent(agentId || undefined);
  const a = liveQ.data ? mapAgent(liveQ.data) : undefined;

  // ── Form state ─────────────────────────────────────────────────────────────
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('Video call');
  const [dur, setDur] = useState<Duration>('30 min'); // default 30 min
  const [notes, setNotes] = useState('');

  // ── The clock the picker is judged against (japa#472) ──────────────────
  // The device's "now", refreshed every 30 seconds while the screen is
  // mounted (a pill turns disabled once its time arrives) and whenever the
  // screen regains focus (coming back from /pay, or from the background
  // after midnight).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), NOW_TICK_MS);
    return () => clearInterval(id);
  }, []);
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
    }, []),
  );

  // Today and the next 13 days as selectable date chips. Keyed on the
  // calendar day so the strip only rebuilds when the date changes (past
  // midnight it drops yesterday and adds a new last day).
  const todayKey = format(now, 'yyyy-MM-dd');
  // Built from the day string (not `now`, which changes every tick), read
  // back as local midnight.
  const days = useMemo(() => {
    const [y, m, d] = todayKey.split('-').map(Number);
    return bookingDays(new Date(y, m - 1, d));
  }, [todayKey]);

  // The 17 half-hour slots (9:00 AM → 5:00 PM), each marked `past` when the
  // picked day is today and the slot has already started.
  const slots = useMemo(() => slotOptions(date, now), [date, now]);
  // Today after 5:00 PM: one line instead of 17 disabled pills.
  const noneLeft = useMemo(() => noSlotsLeft(date, now), [date, now]);

  // A pick that is no longer valid is dropped (japa#472): a time the clock
  // has passed (or that is past on the day just switched to), and a day
  // that fell off the strip at midnight. Continue is then disabled again.
  useEffect(() => {
    const next = validSelection(date, time, now);
    if (next.day !== date) setDate(next.day);
    if (next.time !== time) setTime(next.time);
  }, [date, time, now]);

  if (liveQ.isLoading) {
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

  // Load failed (not a 404) with nothing cached → error + retry.
  if (liveQ.isError && !liveQ.data && !isNotFoundError(liveQ.error)) {
    return (
      <CenteredState
        icon={Ic.users}
        title="We couldn’t load this agent"
        errorMessage={loadErrorCopy('this agent')}
        onRetry={() => liveQ.refetch()}
        retrying={liveQ.isRefetching}
        actionLabel="Back to agents"
        onAction={() => router.replace('/(tabs)/agents')}
      />
    );
  }

  // Not found (404, or no id): the spec's agent not-found state.
  if (!a) {
    return (
      <CenteredState
        icon={Ic.users}
        title="We couldn’t find this agent"
        actionLabel="Back to agents"
        onAction={() => router.replace('/(tabs)/agents')}
      />
    );
  }

  // The agent's fee as the server quoted it (japa#183): local figure +
  // "about $"; dollars only when there is no rate; $0 / none → "Free".
  // Indicative only: the pay screen shows the locked amount.
  const feeParts = priceParts(a.feeLocal, a.feeUsd, { freeWhenNoUsd: true });

  // Continue is enabled only once a date + time + topic are all chosen.
  const canContinue = !!(date && time && topic);

  const onContinue = () => {
    if (!date || !time || !topic) return;
    router.push({
      pathname: '/pay',
      params: {
        agentId: a.id,
        dateIso: format(date, 'yyyy-MM-dd'),
        time,
        topic,
        mode,
        dur,
        // japa#183: no `fee` param. The pay screen books first and shows
        // the server's LOCKED amount; the client never carries a price.
      },
    });
  };

  return (
    <KeyboardAvoidingView
      // japa#472: the screen's root, for the Maestro booking flow.
      testID="screen.book"
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
                {/* Indicative fee (japa#183): "₦47,389 · about $35". */}
                {dur} · {priceInline(feeParts)}
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
            {days.map((d, i) => {
              const on =
                date != null &&
                format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
              return (
                <Pressable
                  key={d.toISOString()}
                  // japa#472: `book.day.0` is today, `book.day.1` tomorrow,
                  // and so on (for the Maestro booking flow).
                  testID={`book.day.${i}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
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
          {noneLeft ? (
            // japa#472: every slot of today has started (after 5:00 PM). The
            // today chip stays in the strip; the time area says so plainly.
            <Text
              testID="book-no-times-left"
              style={{ fontSize: 13.5, lineHeight: 20, color: EX.color.muted }}
            >
              No times left today. Pick another day.
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
              {slots.map(({ label: s, past }, i) => {
                const on = time === s;
                return (
                  <Pressable
                    key={s}
                    // japa#472: `book.time.0` is 9:00 AM … `book.time.16`
                    // is 5:00 PM (for the Maestro booking flow).
                    testID={`book.time.${i}`}
                    // japa#472: a slot that has started cannot be picked.
                    onPress={() => {
                      if (!past) setTime(s);
                    }}
                    disabled={past}
                    accessibilityRole="button"
                    accessibilityLabel={s}
                    accessibilityState={{ disabled: past, selected: on }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 999,
                      // Past = muted: cream fill, no glow, faded label.
                      backgroundColor: on
                        ? EX.color.primary
                        : past
                          ? EX.color.cream
                          : '#fff',
                      opacity: past ? 0.5 : 1,
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
                        color: on
                          ? '#fff'
                          : past
                            ? EX.color.muted
                            : EX.color.inkMuted,
                      }}
                    >
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

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
                  // japa#472: the picked topic reads as selected (also what
                  // the Maestro booking flow checks after its tap).
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
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
            {/* Indicative until the pay screen locks the quote. */}
            <PriceBlock
              parts={feeParts}
              primarySize={20}
              unavailableNote={localUnavailableNote(a.feeLocal?.currency)}
            />
          </View>

          {/* Continue (coral, flex 1, disabled until date+time+topic) */}
          <Pressable
            // japa#472: for the Maestro booking flow (asserted, never tapped).
            testID="book.continue"
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
