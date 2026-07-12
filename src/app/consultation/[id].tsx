// ─────────────────────────────────────────────────────────────────────────────
// Consultation detail (prototype messaging.jsx ConsultationDetailView).
//
// Reads the `:id` route param → `consultById` → resolves the booking's agent via
// `agentById`. Renders a back header ("Consultation") over a ScrollView with:
//   1. a status pill (upcoming / completed / cancelled),
//   2. a "When" card (date · time·dur · mode) styled like the list screen band,
//   3. a "Topic" card,
//   4. an agent card (Pressable → agent page) with a Message shortcut,
//   5. contextual actions (Join call / Reschedule / Cancel · Message / Rebook),
//   6. optional "Your note" and "Session summary" cards.
// A centered "not found" state shows when the id resolves to nothing.
//
// Native primitives only; matches the (explorer) coral/cream design system and
// the card/pill styling of consultations.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import {
  agentById,
  consultById,
  convoForAgent,
  type Consult,
} from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import { Portrait, Pill, Verified } from '@/components/explorer/primitives';
// Live data: fetch a real consultation when the id isn't a demo record.
import { useConsultation } from '@/hooks/useConsultations';
import { mapConsult } from '@/components/explorer/liveConsultations';

// Lucide-style icon component signature (size/color/strokeWidth props).
type IconType = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

// Status → pill colors. Mirrors the list screen: upcoming = blue, completed =
// green, cancelled = grey. Pill text is 11/700 (via Pill `small`).
const STATUS_PILL: Record<
  Consult['status'],
  { label: string; fg: string; bg: string }
> = {
  upcoming: { label: 'Upcoming', fg: '#2F62A0', bg: '#DCEBF7' },
  completed: { label: 'Completed', fg: '#1E8E55', bg: '#D6F2E2' },
  cancelled: { label: 'Cancelled', fg: '#8B8499', bg: 'rgba(23,19,38,0.06)' },
};

// ── Row inside the "When" card: leading icon chip + label ─────────────────────
function WhenRow({ icon: IconCmp, label }: { icon: IconType; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
      {/* Cream icon chip (matches IconChip look used across the explorer). */}
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: EX.color.cream,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconCmp size={16} color={EX.color.primary} strokeWidth={1.8} />
      </View>
      <Text style={{ fontSize: 14.5, fontWeight: '600', color: EX.color.ink }}>
        {label}
      </Text>
    </View>
  );
}

// ── Action button (filled coral OR outline), same spec as consultations.tsx ───
// `grow` → flex:1; otherwise fixed width via horizontal padding.
function ActionBtn({
  label,
  icon: IconCmp,
  filled,
  grow,
  onPress,
}: {
  label: string;
  icon?: IconType;
  filled?: boolean;
  grow?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        ...(grow ? { flex: 1 } : { paddingHorizontal: 18 }),
        height: 48,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: filled ? EX.color.primary : '#fff',
        borderWidth: filled ? 0 : 1,
        borderColor: EX.color.line12,
        shadowColor: EX.color.primary,
        shadowOpacity: filled ? 0.4 : 0,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: filled ? 4 : 0,
      }}
    >
      {IconCmp ? (
        <IconCmp
          size={17}
          color={filled ? '#fff' : EX.color.ink}
          strokeWidth={1.8}
        />
      ) : null}
      <Text
        style={{
          fontSize: 14.5,
          fontWeight: '700',
          color: filled ? '#fff' : EX.color.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Labelled text card (Topic / Your note / Session summary) ──────────────────
function LabelCard({ label, body }: { label: string; body: string }) {
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: EX.color.line06,
        padding: 16,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: EX.color.muted,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 15,
          fontWeight: '600',
          color: EX.color.ink,
          lineHeight: 21,
        }}
      >
        {body}
      </Text>
    </View>
  );
}

export default function ConsultationDetailView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Resolve demo-first, then fall back to the backend. The live query is
  // disabled (id undefined) when a demo record matched, so we only hit the
  // network for real consultation ids.
  const demo = consultById(id);
  const liveQ = useConsultation(demo ? undefined : id);
  const c = demo ?? (liveQ.data ? mapConsult(liveQ.data) : undefined);
  const a = c ? agentById(c.agentId) : undefined;
  // Agent portrait/name fallback for live consultations (not in demo AGENTS).
  const agentName = a?.n ?? c?.agentName ?? 'Agent';
  const agentSeed = a?.seed ?? 0;

  // ── Loading state — initial live fetch in flight, no demo match. ────────────
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

  // ── Not-found state ─────────────────────────────────────────────────────────
  if (!c) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: EX.color.bg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 40,
        }}
      >
        <Ic.cal size={38} color={EX.color.muted} strokeWidth={1.8} />
        <Text style={{ fontSize: 15, color: EX.color.muted, marginTop: 12 }}>
          Consultation not found.
        </Text>
      </View>
    );
  }

  const pill = STATUS_PILL[c.status];
  const isVideo = c.mode.toLowerCase().includes('video');

  // Message action: open the existing conversation with this agent if one
  // exists, else fall back to the agent's profile page.
  const openChat = () => {
    const convo = convoForAgent(c.agentId);
    if (convo) router.push(`/messages/${convo.id}`);
    else router.push(`/agent/${c.agentId}`);
  };

  // Join call → open a meeting link (demo). Guarded in case the link can't open.
  const joinCall = async () => {
    try {
      await Linking.openURL('https://meet.google.com/');
    } catch {
      Alert.alert('Unable to open the meeting link.');
    }
  };

  // Cancel → confirm before (demo) dismissing the booking.
  const confirmCancel = () => {
    Alert.alert(
      'Cancel consultation?',
      'This will release your booked slot. You can rebook anytime.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel consultation',
          style: 'destructive',
          onPress: () => router.back(),
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* ── Back header ───────────────────────────────────────────────────── */}
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
        <Text style={displayText(24, 'semibold')}>Consultation</Text>
      </View>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: 12,
          paddingBottom: 40,
          gap: 14,
        }}
      >
        {/* 1 · Status pill (11/700 via `small`). */}
        <Pill label={pill.label} fg={pill.fg} bg={pill.bg} small />

        {/* 2 · "When" card — date, time·dur, mode. */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: EX.color.line06,
            padding: 16,
            gap: 14,
          }}
        >
          <WhenRow icon={Ic.cal} label={c.date} />
          <WhenRow icon={Ic.clock} label={`${c.time} · ${c.dur}`} />
          <WhenRow icon={isVideo ? Ic.video : Ic.phone} label={c.mode} />
        </View>

        {/* 3 · Topic card. */}
        <LabelCard label="Topic" body={c.topic} />

        {/* 4 · Agent card → agent profile; with a Message shortcut. */}
        {a || c.agentName ? (
          <Pressable
            onPress={() => router.push(`/agent/${c.agentId}`)}
            style={{
              backgroundColor: '#fff',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: EX.color.line06,
              padding: 16,
              gap: 14,
            }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <Portrait seed={agentSeed} size={48} name={agentName} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: EX.color.ink,
                    }}
                    numberOfLines={1}
                  >
                    {agentName}
                  </Text>
                  <Verified size={16} />
                </View>
                <Text
                  style={{
                    fontSize: 12.5,
                    color: EX.color.muted,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {a?.spec ?? 'Visa specialist'}
                </Text>
              </View>
              <Ic.chevR size={20} color={EX.color.muted} strokeWidth={1.8} />
            </View>

            {/* Message button — routes to the conversation (or agent page). */}
            <Pressable
              onPress={openChat}
              style={{
                height: 44,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: EX.color.line12,
                backgroundColor: '#fff',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Ic.msg size={16} color={EX.color.ink} strokeWidth={1.8} />
              <Text
                style={{
                  fontSize: 13.5,
                  fontWeight: '700',
                  color: EX.color.ink,
                }}
              >
                Message
              </Text>
            </Pressable>
          </Pressable>
        ) : null}

        {/* 5 · Actions — vary by status (cancelled shows none). */}
        {c.status === 'upcoming' ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <ActionBtn
                label="Join call"
                icon={Ic.video}
                filled
                grow
                onPress={joinCall}
              />
              <ActionBtn
                label="Reschedule"
                grow
                onPress={() => router.push(`/book/${c.agentId}`)}
              />
            </View>
            {/* Danger text — Cancel consultation (with confirm). */}
            <Pressable
              onPress={confirmCancel}
              hitSlop={6}
              style={{ alignItems: 'center', paddingVertical: 8 }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: EX.color.danger,
                }}
              >
                Cancel consultation
              </Text>
            </Pressable>
          </View>
        ) : c.status === 'completed' ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <ActionBtn
              label="Message agent"
              icon={Ic.msg}
              grow
              onPress={openChat}
            />
            <ActionBtn
              label="Rebook"
              grow
              onPress={() => router.push(`/book/${c.agentId}`)}
            />
          </View>
        ) : null}

        {/* 6 · Optional note / summary cards. */}
        {c.notes ? <LabelCard label="Your note" body={c.notes} /> : null}
        {c.summary ? (
          <LabelCard label="Session summary" body={c.summary} />
        ) : null}
      </ScrollView>
    </View>
  );
}
