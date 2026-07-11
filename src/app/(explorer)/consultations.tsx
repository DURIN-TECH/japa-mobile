// ─────────────────────────────────────────────────────────────────────────────
// Consultations (prototype messaging.jsx ConsultationsView).
// Back header + subtitle, a row of filter chips (Upcoming / Completed /
// Cancelled), then a list of consultation cards. Each card shows the agent, the
// topic, a status pill, and a cream "info band" (date · time·dur · mode) with
// contextual action buttons. An empty state shows when a filter has no results.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import {
  CONSULTS,
  CONVOS,
  agentById,
  type Consult,
} from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import { Portrait, Pill } from '@/components/explorer/primitives';
// Live data: real consultations from the backend, mapped onto the demo `Consult`
// shape. Falls back to the demo CONSULTS when the backend has none.
import { useConsultations } from '@/hooks/useConsultations';
import { mapConsult } from '@/components/explorer/liveConsultations';

// Lucide-style icon component signature (size/color/strokeWidth props).
type IconType = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

// Filter tabs (values map 1:1 to Consult.status).
const FILTERS: { key: Consult['status']; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

// Status → pill colors (green / blue / grey).
const STATUS_PILL: Record<
  Consult['status'],
  { label: string; fg: string; bg: string }
> = {
  // Source: upcoming = blue, completed = green, cancelled = grey.
  upcoming: { label: 'Upcoming', fg: '#2F62A0', bg: '#DCEBF7' },
  completed: { label: 'Completed', fg: '#1E8E55', bg: '#D6F2E2' },
  cancelled: { label: 'Cancelled', fg: EX.color.muted, bg: EX.color.line06 },
};

// ── Small labelled icon group inside the cream info band ──────────────────────
// Source: icons inherit the row's text color (#5B5468), not amber.
function InfoBit({ icon: IconCmp, label }: { icon: IconType; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <IconCmp size={14} color={EX.color.inkMuted} strokeWidth={1.8} />
      <Text
        style={{ fontSize: 12.5, fontWeight: '600', color: EX.color.inkMuted }}
      >
        {label}
      </Text>
    </View>
  );
}

// ── 3px dot separator between info-band bits ──────────────────────────────────
function DotSep() {
  return (
    <View
      style={{
        width: 3,
        height: 3,
        borderRadius: 3,
        backgroundColor: EX.color.line24,
      }}
    />
  );
}

// ── Action button (filled coral OR outline) ───────────────────────────────────
// `grow` → flex:1 (Join call / completed Message); otherwise fixed width with
// horizontal padding (upcoming Message / Rebook), matching the source layout.
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
        height: 44,
        borderRadius: 13,
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
          size={16}
          color={filled ? '#fff' : EX.color.ink}
          strokeWidth={1.8}
        />
      ) : null}
      <Text
        style={{
          fontSize: 13.5,
          fontWeight: '700',
          color: filled ? '#fff' : EX.color.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function ConsultationsView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Consult['status']>('upcoming');

  // Fetch the current user's consultations (role=client) and map them onto the
  // demo `Consult` shape. Live-with-demo-fallback: use live rows when present,
  // otherwise the demo CONSULTS so the screen is never empty.
  const consultsQ = useConsultations();
  const live = useMemo(
    () => (consultsQ.data ?? []).map(mapConsult),
    [consultsQ.data],
  );
  const list0 = live.length ? live : CONSULTS;

  const list = list0.filter((c) => c.status === filter);

  // Message action routes to the conversation with this agent (else agent page).
  const openChat = (agentId: string) => {
    const convo = CONVOS.find((c) => c.agentId === agentId);
    if (convo) router.push(`/(explorer)/messages/${convo.id}`);
    else router.push(`/(explorer)/agent/${agentId}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* ── Back header ───────────────────────────────────────────────────── */}
      <View
        style={{
          // Source header: padding '60px 18px 6px'.
          paddingTop: insets.top + 8,
          paddingHorizontal: 18,
          paddingBottom: 6,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={{
              width: 40, // source: 40px back button
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
            <Text style={displayText(24, 'semibold')}>Consultations</Text>
            <Text
              style={{ fontSize: 12.5, color: EX.color.muted, marginTop: 2 }}
            >
              Your scheduled sessions with agents
            </Text>
          </View>
        </View>
      </View>

      {/* ── Filter chips (source row: padding '14px 22px 6px', gap 8) ──────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 8,
          paddingHorizontal: 22,
          paddingTop: 14,
          paddingBottom: 6,
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
                  // Source: active text #FBF7F0, inactive #5B5468.
                  color: on ? '#FBF7F0' : EX.color.inkMuted,
                }}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── List / empty state ────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          // Source list: padding '10px 22px 40px', gap 12.
          paddingHorizontal: 22,
          paddingTop: 10,
          paddingBottom: 40,
          gap: 12,
        }}
      >
        {list.length === 0 ? (
          // Source empty state: bare 38px calendar (opacity 0.5) + 14px caption.
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 48,
              gap: 12,
            }}
          >
            <Ic.cal
              size={38}
              color={EX.color.muted}
              strokeWidth={1.8}
              style={{ opacity: 0.5 }}
            />
            <Text style={{ fontSize: 14, color: EX.color.muted }}>
              No {filter} consultations
            </Text>
          </View>
        ) : (
          list.map((c) => {
            // Resolve the agent's portrait/name. Live consultations reference
            // agents that aren't in the demo AGENTS list, so fall back to the
            // denormalized `agentName` (and seed 0) the backend provides.
            const a = agentById(c.agentId);
            const agentName = a?.n ?? c.agentName ?? 'Agent';
            const agentSeed = a?.seed ?? 0;
            const pill = STATUS_PILL[c.status];
            const isVideo = c.mode.toLowerCase().includes('video');
            return (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/(explorer)/consultation/${c.id}`)}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 20, // source card radius
                  borderWidth: 1,
                  borderColor: 'rgba(23,19,38,0.07)',
                  padding: 15,
                  // Source: cancelled cards dim to 0.7 opacity.
                  opacity: c.status === 'cancelled' ? 0.7 : 1,
                  shadowColor: '#171326',
                  shadowOpacity: 0.04,
                  shadowRadius: 2,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 1,
                }}
              >
                {/* Agent + topic + status */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <Portrait seed={agentSeed} size={46} name={agentName} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: EX.color.ink,
                      }}
                      numberOfLines={1}
                    >
                      {agentName}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12.5,
                        color: EX.color.muted, // source topic #8B8499
                        marginTop: 1,
                      }}
                      numberOfLines={1}
                    >
                      {c.topic}
                    </Text>
                  </View>
                  <Pill
                    label={pill.label}
                    fg={pill.fg}
                    bg={pill.bg}
                    small
                    style={{ paddingHorizontal: 10, paddingVertical: 5 }}
                  />
                </View>

                {/* Cream info band: date · time·dur · mode (source: radius 13, gap 8, 3px dots) */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                    backgroundColor: EX.color.cream,
                    borderRadius: 13,
                    paddingHorizontal: 13,
                    paddingVertical: 11,
                    marginTop: 13,
                  }}
                >
                  <InfoBit icon={Ic.cal} label={c.date} />
                  <DotSep />
                  <InfoBit icon={Ic.clock} label={`${c.time} · ${c.dur}`} />
                  <DotSep />
                  <InfoBit
                    icon={isVideo ? Ic.video : Ic.phone}
                    label={c.mode}
                  />
                </View>

                {/* Actions — source: cancelled shows none; upcoming = Join call + Message;
                    completed = "Message agent" (flex) + Rebook. */}
                {c.status !== 'cancelled' ? (
                  <View
                    style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}
                  >
                    {c.status === 'upcoming' ? (
                      <>
                        <ActionBtn
                          label="Join call"
                          icon={Ic.video}
                          filled
                          grow
                          onPress={() =>
                            router.push(`/(explorer)/consultation/${c.id}`)
                          }
                        />
                        <ActionBtn
                          label="Message"
                          icon={Ic.msg}
                          onPress={() => openChat(c.agentId)}
                        />
                      </>
                    ) : (
                      <>
                        <ActionBtn
                          label="Message agent"
                          icon={Ic.msg}
                          grow
                          onPress={() => openChat(c.agentId)}
                        />
                        <ActionBtn
                          label="Rebook"
                          onPress={() =>
                            router.push(`/(explorer)/book/${c.agentId}`)
                          }
                        />
                      </>
                    )}
                  </View>
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
