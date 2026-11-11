// ─────────────────────────────────────────────────────────────────────────────
// Home dashboard (prototype home.jsx HomeView) — default first tab.
// Summary of the user's applications + fast entry points. Ported 1:1 from source
// (heights, paddings, radii, scrim angles, font sizes/weights preserved).
//
// japa#145: live data only, no demo persona.
//   • Greeting + portrait: the signed-in user from GET /users/me (no ME).
//   • Applications: GET /applications — the hero, the next-step nudge and the
//     active-applications card show only real rows, with one loading / error /
//     first-run pattern for the whole group (design spec section 3).
//   • "Partners near you" is REMOVED: its only sources were the demo PROMOS and
//     live agencies labelled "Sponsored" / "Featured partner" without any
//     sponsorship data — a trust claim that isn't true. Not replaced.
//   • "Recommended for you": GET /visas (+ /countries), its own loading /
//     error state; hidden entirely when nothing is left to recommend.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { STATUS } from '@/components/explorer/data';
import type { App, Dest } from '@/types/explorer.type';
// ── Live adapters + React Query hooks (japa#145: no demo fallbacks) ──────────
import { mapApplication } from '@/components/explorer/liveApplications';
import { mapVisasToDests } from '@/components/explorer/liveExplore';
import { useApplications } from '@/hooks/useApplications';
import { useVisaTypes, useCountriesWithVisas } from '@/hooks/useVisaTypes';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useMe } from '@/hooks/useMe';
import { profileName, profileSeed } from '@/components/explorer/liveProfile';
import { Ic } from '@/components/explorer/icons';
import {
  Card,
  Flag,
  Portrait,
  Progress,
  StatusPill,
} from '@/components/explorer/primitives';
import {
  StateEmpty,
  StateError,
  StateLoading,
  loadErrorCopy,
  queryState,
} from '@/components/explorer/states';

// ── Quick-action tile ────────────────────────────────────────────────────────
function QuickAction({
  icon: IconCmp,
  label,
  tone,
  onPress,
}: {
  icon: React.ElementType;
  label: string;
  tone: { bg: string; fg: string };
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: EX.color.line06,
        borderRadius: 18,
        paddingHorizontal: 13,
        paddingTop: 13,
        paddingBottom: 14,
        gap: 10,
        shadowColor: '#171326',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tone.bg,
        }}
      >
        <IconCmp size={20} color={tone.fg} strokeWidth={1.8} />
      </View>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: EX.color.ink,
          lineHeight: 15.6,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Compact application row (active-applications list) ───────────────────────
// Accepts the mapped `App` object directly. Every live row carries a
// self-contained `dest` (mapApplication builds it from the country assets).
function MiniAppRow({ app, onPress }: { app: App; onPress: () => void }) {
  const d = app.dest;
  if (!d) return null;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 11,
        paddingHorizontal: 12,
        borderRadius: 16,
      }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 13,
          overflow: 'hidden',
          backgroundColor: d.tone,
        }}
      >
        <Image
          source={{ uri: d.img }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={150}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Flag code={d.flag} size={14} radius={4} />
          <Text
            style={{ fontSize: 14.5, fontWeight: '700', color: EX.color.ink }}
            numberOfLines={1}
          >
            {d.visa}
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 6,
          }}
        >
          <Progress value={app.progress} height={5} style={{ flex: 1 }} />
          <Text
            style={{ fontSize: 11.5, fontWeight: '700', color: EX.color.muted }}
          >
            {Math.round(app.progress * 100)}%
          </Text>
        </View>
      </View>
      <StatusPill status={app.status} small />
    </Pressable>
  );
}

// ── Recommended destination card (horizontal rail) ───────────────────────────
// Accepts the resolved `Dest` directly (mapped from GET /visas + /countries).
function RecoCard({ d, onPress }: { d: Dest; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 158,
        height: 200,
        borderRadius: 22,
        overflow: 'hidden',
        backgroundColor: d.tone,
        shadowColor: '#171326',
        shadowOpacity: 0.16,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 12 },
        elevation: 5,
      }}
    >
      <Image
        source={{ uri: d.img }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        contentFit="cover"
        transition={150}
      />
      <LinearGradient
        colors={['rgba(12,10,8,0)', 'rgba(12,10,8,0.08)', 'rgba(12,10,8,0.76)']}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <View style={{ position: 'absolute', top: 11, right: 11 }}>
        <BlurView
          intensity={16}
          tint="light"
          style={{
            overflow: 'hidden',
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.28)',
            backgroundColor: 'rgba(255,255,255,0.16)',
            paddingHorizontal: 9,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '700' }}>
            ${d.price.toLocaleString()}
          </Text>
        </BlurView>
      </View>
      <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 4,
          }}
        >
          <Flag code={d.flag} size={15} radius={4} />
          <Text
            style={{
              color: '#fff',
              fontSize: 11,
              fontWeight: '600',
              opacity: 0.9,
            }}
            numberOfLines={1}
          >
            {d.country}
          </Text>
        </View>
        <Text
          style={{
            color: '#fff',
            fontFamily: EX.font.display.semibold,
            fontSize: 16,
            letterSpacing: -0.16,
            textShadowColor: 'rgba(0,0,0,0.3)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 10,
          }}
          numberOfLines={2}
        >
          {d.visa}
        </Text>
      </View>
    </Pressable>
  );
}

// Small circular header button (message / bell) with unread dot.
// `showDot` gates the coral unread indicator: the message button keeps it always
// on (default true); the bell passes the live unread-notification count.
function HeaderButton({
  icon: IconCmp,
  onPress,
  showDot = true,
}: {
  icon: React.ElementType;
  onPress: () => void;
  showDot?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 1,
        borderColor: EX.color.line10,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <IconCmp size={19} color={EX.color.ink} strokeWidth={1.8} />
      {showDot ? (
        <View
          style={{
            position: 'absolute',
            top: 9,
            right: 10,
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: EX.color.primary,
            borderWidth: 2,
            borderColor: '#fff',
          }}
        />
      ) : null}
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Applications (GET /applications) — japa#145: no demo APPS ──────────────
  // Live rows map through `mapApplication` (each carries a self-contained
  // `dest`). Powers the hero, the next-step nudge and the active-applications
  // card. `state` follows the shared rule: spinner only on a first load with
  // nothing cached, error only when nothing is cached.
  const appsQ = useApplications();
  const apps: App[] = useMemo(
    () => (appsQ.data ?? []).map((a) => mapApplication(a)),
    [appsQ.data],
  );
  const appsState = queryState(appsQ);
  const appsReady = appsState === 'ready';
  // First run: the source answered and the user has no applications at all.
  const appsFirstRun = appsReady && apps.length === 0;

  // Hero = the first application; its destination comes from the case itself.
  const lead = apps[0];
  const dLead = lead?.dest;
  // Next-step nudge = the first application with an outstanding CTA, else the lead.
  const actionApp = apps.find((a) => a.next.cta) ?? lead;
  const dAction = actionApp?.dest;

  // ── Recommended (GET /visas + /countries) — japa#145: no demo DESTS ─────────
  // Drop any destination the user already has an application for and keep a few.
  // Its own loading / error / empty state, independent of the applications'.
  const visaQ = useVisaTypes({ limit: 30 });
  const { data: countries } = useCountriesWithVisas();
  const recState = queryState(visaQ);
  const rec = useMemo<Dest[]>(() => {
    const src = mapVisasToDests(visaQ.data?.visaTypes ?? [], countries ?? []);
    return src.filter((d) => !apps.some((a) => a.destId === d.id)).slice(0, 4);
  }, [visaQ.data, countries, apps]);

  // ── Signed-in user (GET /users/me) for the greeting + portrait ─────────────
  const { data: me } = useMe();
  const myName = profileName(me);

  // ── Unread notification count — gates the coral dot on the bell ────────────
  const unread = useUnreadNotificationCount();
  const hasUnread = (unread.data ?? 0) > 0;

  // "Check eligibility" needs a real visa: with an application it opens that
  // application's visa; with none it goes to the Explore tab to pick one
  // (the demo DESTS[0] default is gone). Tab hops use the selection haptic.
  const checkEligibility = () => {
    if (lead && dLead) {
      router.push({
        pathname: '/eligibility',
        params: { dest: lead.destId, code: dLead.flag },
      });
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    router.push('/(tabs)/explore');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: EX.color.bg }}
      showsVerticalScrollIndicator={false}
      // tab-clear keeps the last section clear of the tab bar now that the
      // Partners row is gone (design spec section 3).
      contentContainerStyle={{ paddingBottom: EX.space.tabClear }}
    >
      {/* Greeting */}
      <View
        style={{
          paddingTop: insets.top + 14,
          paddingHorizontal: 22,
          paddingBottom: 6,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1, minWidth: 0, marginRight: 9 }}>
          <Text
            style={{ fontSize: 13, color: EX.color.muted, fontWeight: '600' }}
          >
            Good morning
          </Text>
          {/* Real name from GET /users/me; while it loads, the "Good
              morning" line alone (never a persona). One line, ellipsised at
              320pt. */}
          {myName ? (
            <Text
              numberOfLines={1}
              style={[displayText(27, 'semibold'), { marginTop: 2 }]}
            >
              {myName}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <HeaderButton
            icon={Ic.msg}
            onPress={() => router.push('/messages')}
          />
          <HeaderButton
            icon={Ic.bell}
            onPress={() => router.push('/notifications')}
            showDot={hasUnread}
          />
          {/* Portrait initials come from the real name once it has loaded. */}
          {myName ? (
            <Pressable onPress={() => router.push('/(tabs)/profile')}>
              <Portrait seed={profileSeed(me)} size={42} name={myName} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ── HERO + next-step nudge — only with real applications ────────────── */}
      {appsReady && apps.length > 0 ? (
        <>
          {/* HERO — application closest to the finish line */}
          {lead && dLead ? (
            <View
              style={{
                paddingHorizontal: 22,
                paddingTop: 14,
                paddingBottom: 4,
              }}
            >
              <Pressable
                onPress={() => router.push(`/application/${lead.id}`)}
                style={{
                  height: 210,
                  borderRadius: 26,
                  overflow: 'hidden',
                  backgroundColor: dLead.tone,
                  shadowColor: '#171326',
                  shadowOpacity: 0.22,
                  shadowRadius: 22,
                  shadowOffset: { width: 0, height: 16 },
                  elevation: 7,
                }}
              >
                <Image
                  source={{ uri: dLead.img }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                  }}
                  contentFit="cover"
                  transition={200}
                />
                <LinearGradient
                  colors={[
                    'rgba(12,10,8,0.8)',
                    'rgba(12,10,8,0.34)',
                    'rgba(12,10,8,0.12)',
                  ]}
                  locations={[0, 0.58, 1]}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                  }}
                />
                <View
                  style={{
                    flex: 1,
                    padding: 18,
                    justifyContent: 'space-between',
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                    }}
                  >
                    <BlurView
                      intensity={14}
                      tint="light"
                      style={{
                        overflow: 'hidden',
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.28)',
                        backgroundColor: 'rgba(255,255,255,0.14)',
                        paddingHorizontal: 11,
                        paddingVertical: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: '700',
                          letterSpacing: 0.44,
                          textTransform: 'uppercase',
                        }}
                      >
                        Closest to approval
                      </Text>
                    </BlurView>
                    <BlurView
                      intensity={14}
                      tint="dark"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.28)',
                        backgroundColor: 'rgba(20,16,12,0.24)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ic.arrowUR size={17} color="#fff" strokeWidth={1.8} />
                    </BlurView>
                  </View>
                  <View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 7,
                        marginBottom: 6,
                      }}
                    >
                      <Flag code={dLead.flag} size={18} radius={5} />
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: '600',
                          color: 'rgba(255,255,255,0.92)',
                        }}
                      >
                        {dLead.country} · Ref {lead.ref}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: '#fff',
                        fontFamily: EX.font.display.semibold,
                        fontSize: 24,
                        letterSpacing: -0.24,
                        textShadowColor: 'rgba(0,0,0,0.35)',
                        textShadowOffset: { width: 0, height: 2 },
                        textShadowRadius: 12,
                      }}
                    >
                      {dLead.visa}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 12,
                      }}
                    >
                      <Progress
                        value={lead.progress}
                        height={6}
                        color="#fff"
                        track="rgba(255,255,255,0.25)"
                        style={{ flex: 1 }}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: '#fff',
                        }}
                      >
                        {Math.round(lead.progress * 100)}% ·{' '}
                        {STATUS[lead.status]?.label ?? ''}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            </View>
          ) : null}

          {/* Next-step nudge — only when an application has an outstanding CTA */}
          {actionApp && actionApp.next.cta && dAction ? (
            <View
              style={{
                paddingHorizontal: 22,
                paddingTop: 14,
                paddingBottom: 2,
              }}
            >
              <Pressable
                onPress={() => router.push(`/application/${actionApp.id}`)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 13,
                  padding: 15,
                  borderRadius: 20,
                  backgroundColor: EX.color.ink,
                  shadowColor: '#171326',
                  shadowOpacity: 0.5,
                  shadowRadius: 24,
                  shadowOffset: { width: 0, height: 16 },
                  elevation: 8,
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ic.upload size={20} color="#fff" strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontSize: 11.5,
                      color: 'rgba(255,255,255,0.6)',
                      fontWeight: '600',
                    }}
                  >
                    Action needed · {dAction.country}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14.5,
                      fontWeight: '700',
                      color: '#fff',
                    }}
                    numberOfLines={1}
                  >
                    {actionApp.next.label}
                  </Text>
                </View>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: EX.color.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ic.chevR size={18} color="#fff" strokeWidth={1.8} />
                </View>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}

      {/* Quick actions — always shown */}
      <View
        style={{
          flexDirection: 'row',
          gap: 11,
          paddingHorizontal: 22,
          paddingTop: 18,
        }}
      >
        <QuickAction
          icon={Ic.globe}
          label="Explore visas"
          tone={{ bg: EX.color.primaryTint10, fg: EX.color.primary }}
          onPress={() => router.push('/(tabs)/explore')}
        />
        <QuickAction
          icon={Ic.shield}
          label="Check eligibility"
          tone={{ bg: EX.color.tealTint14, fg: EX.color.success }}
          onPress={checkEligibility}
        />
        <QuickAction
          icon={Ic.users}
          label="Find an agent"
          tone={{ bg: EX.color.purpleTint, fg: EX.color.purple }}
          onPress={() => router.push('/(tabs)/agents')}
        />
      </View>

      {/* ── Active applications / its loading · error · first-run states ──────
          One group state for the whole block (design spec section 3). */}
      {appsState === 'loading' ? (
        // First load: one coral spinner in place of the hero, the nudge and
        // this card together.
        <StateLoading style={{ paddingVertical: 48 }} />
      ) : appsState === 'error' ? (
        // Load failed, nothing cached: InlineError + Outline "Try again".
        // The hero and nudge stay hidden — no fabricated rows.
        <StateError
          message={loadErrorCopy('your applications')}
          onRetry={() => appsQ.refetch()}
          retrying={appsQ.isRefetching}
        />
      ) : appsFirstRun ? (
        // First run: a section Card with the "No applications yet" empty
        // state; the coral "Start exploring" is first-run Home's one coral
        // action and opens the Explore tab.
        <View style={{ paddingHorizontal: 22 }}>
          <Card padded={false} style={{ marginTop: 26 }}>
            <StateEmpty
              icon={Ic.layers}
              title="No applications yet"
              body="Pick a destination and we’ll track every step from here."
              action={{
                label: 'Start exploring',
                onPress: () => {
                  Haptics.selectionAsync().catch(() => {});
                  router.push('/(tabs)/explore');
                },
                variant: 'coral',
              }}
            />
          </Card>
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: 22 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginTop: 26,
                marginBottom: 13,
                marginHorizontal: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: EX.color.ink,
                  letterSpacing: -0.18,
                }}
              >
                Active applications
              </Text>
              {apps.length ? (
                <Pressable
                  onPress={() => router.push('/(tabs)/tracker')}
                  hitSlop={8}
                >
                  <Text
                    style={{
                      color: EX.color.primary,
                      fontSize: 13.5,
                      fontWeight: '600',
                    }}
                  >
                    See all
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View
              style={{
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: EX.color.line06,
                borderRadius: 22,
                padding: 5,
                shadowColor: '#171326',
                shadowOpacity: 0.04,
                shadowRadius: 2,
                shadowOffset: { width: 0, height: 1 },
                elevation: 1,
              }}
            >
              {apps.map((a, i) => (
                <React.Fragment key={a.id}>
                  {i > 0 ? (
                    <View
                      style={{
                        height: 1,
                        backgroundColor: EX.color.line06,
                        marginHorizontal: 12,
                      }}
                    />
                  ) : null}
                  <MiniAppRow
                    app={a}
                    onPress={() => router.push(`/application/${a.id}`)}
                  />
                </React.Fragment>
              ))}
            </View>
          </View>
        </>
      )}

      {/* Recommended for you (GET /visas) — japa#145: its own loading / error
          state, and hidden entirely when nothing is left to recommend (the
          Explore quick action covers it). */}
      {recState !== 'ready' || rec.length > 0 ? (
        <>
          <View style={{ paddingHorizontal: 22 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginTop: 26,
                marginBottom: 13,
                marginHorizontal: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: EX.color.ink,
                  letterSpacing: -0.18,
                }}
              >
                Recommended for you
              </Text>
              <Pressable
                onPress={() => router.push('/(tabs)/explore')}
                hitSlop={8}
              >
                <Text
                  style={{
                    color: EX.color.primary,
                    fontSize: 13.5,
                    fontWeight: '600',
                  }}
                >
                  Explore
                </Text>
              </Pressable>
            </View>
          </View>
          {recState === 'loading' ? (
            // First load: a section spinner in place of the rail.
            <StateLoading />
          ) : recState === 'error' ? (
            <StateError
              message={loadErrorCopy('destinations')}
              onRetry={() => visaQ.refetch()}
              retrying={visaQ.isRefetching}
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: 13,
                paddingHorizontal: 22,
                paddingBottom: 4,
              }}
            >
              {rec.map((d) => (
                <RecoCard
                  key={d.id}
                  d={d}
                  onPress={() =>
                    router.push({
                      pathname: '/destination/[id]',
                      params: { id: d.id, code: d.flag },
                    })
                  }
                />
              ))}
            </ScrollView>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}
