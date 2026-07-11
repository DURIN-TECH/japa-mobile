// ─────────────────────────────────────────────────────────────────────────────
// Home dashboard (prototype home.jsx HomeView) — default first tab.
// Summary of the user's applications + fast entry points. Ported 1:1 from source
// (heights, paddings, radii, scrim angles, font sizes/weights preserved).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { APPS, DESTS, PROMOS, STATUS, ME, agencyById, appById, destById } from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import { Flag, Portrait, Progress, StatusPill, Verified } from '@/components/explorer/primitives';

// ── Quick-action tile ────────────────────────────────────────────────────────
function QuickAction({
  icon: IconCmp, label, tone, onPress,
}: { icon: React.ComponentType<any>; label: string; tone: { bg: string; fg: string }; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1, minWidth: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: EX.color.line06,
        borderRadius: 18, paddingHorizontal: 13, paddingTop: 13, paddingBottom: 14, gap: 10,
        shadowColor: '#171326', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
      }}
    >
      <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: tone.bg }}>
        <IconCmp size={20} color={tone.fg} strokeWidth={1.8} />
      </View>
      <Text style={{ fontSize: 13, fontWeight: '700', color: EX.color.ink, lineHeight: 15.6 }}>{label}</Text>
    </Pressable>
  );
}

// ── Compact application row (active-applications list) ───────────────────────
function MiniAppRow({ appId, onPress }: { appId: string; onPress: () => void }) {
  const app = appById(appId)!;
  const d = destById(app.destId)!;
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 16 }}>
      <View style={{ width: 46, height: 46, borderRadius: 13, overflow: 'hidden', backgroundColor: d.tone }}>
        <Image source={{ uri: d.img }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Flag code={d.flag} size={14} radius={4} />
          <Text style={{ fontSize: 14.5, fontWeight: '700', color: EX.color.ink }} numberOfLines={1}>{d.visa}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <Progress value={app.progress} height={5} style={{ flex: 1 }} />
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: EX.color.muted }}>{Math.round(app.progress * 100)}%</Text>
        </View>
      </View>
      <StatusPill status={app.status} small />
    </Pressable>
  );
}

// ── Recommended destination card (horizontal rail) ───────────────────────────
function RecoCard({ destId, onPress }: { destId: string; onPress: () => void }) {
  const d = destById(destId)!;
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 158, height: 200, borderRadius: 22, overflow: 'hidden', backgroundColor: d.tone,
        shadowColor: '#171326', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 5,
      }}
    >
      <Image source={{ uri: d.img }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} contentFit="cover" transition={150} />
      <LinearGradient
        colors={['rgba(12,10,8,0)', 'rgba(12,10,8,0.08)', 'rgba(12,10,8,0.76)']}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <View style={{ position: 'absolute', top: 11, right: 11 }}>
        <BlurView intensity={16} tint="light" style={{ overflow: 'hidden', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 9, paddingVertical: 4 }}>
          <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '700' }}>${d.price.toLocaleString()}</Text>
        </BlurView>
      </View>
      <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Flag code={d.flag} size={15} radius={4} />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', opacity: 0.9 }} numberOfLines={1}>{d.country}</Text>
        </View>
        <Text style={{ color: '#fff', fontFamily: EX.font.display.semibold, fontSize: 16, letterSpacing: -0.16, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 10 }} numberOfLines={2}>
          {d.visa}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Sponsored / promoted agency card ("Partners near you") ───────────────────
// Paid placement: an agency `cover` photo, a glass "Sponsored / Featured partner"
// label, the agency identity, an offer headline and a CTA pill. 1:1 with source.
function PartnerCard({ promo, onPress }: { promo: (typeof PROMOS)[number]; onPress: () => void }) {
  const ag = agencyById(promo.id);
  if (!ag) return null;
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 300, height: 158, borderRadius: 22, overflow: 'hidden', backgroundColor: ag.tone,
        shadowColor: '#171326', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 5,
      }}
    >
      <Image source={{ uri: ag.cover }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} contentFit="cover" transition={150} />
      <LinearGradient
        colors={['rgba(12,10,8,0.86)', 'rgba(12,10,8,0.4)', 'rgba(12,10,8,0.12)']}
        locations={[0, 0.58, 1]}
        start={{ x: 0.15, y: 1 }}
        end={{ x: 0.85, y: 0 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      {/* Honest "sponsored" label */}
      <View style={{ position: 'absolute', top: 12, right: 12 }}>
        <BlurView intensity={12} tint="light" style={{ flexDirection: 'row', alignItems: 'center', gap: 5, overflow: 'hidden', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 9, paddingVertical: 4 }}>
          <Ic.spark size={11} color="#fff" strokeWidth={1.8} />
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>{promo.label}</Text>
        </BlurView>
      </View>
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 15 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' }}>
            <Image source={{ uri: ag.cover }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          </View>
          <View style={{ minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{ag.name}</Text>
              <Verified size={13} />
            </View>
            <Text style={{ color: '#fff', fontSize: 11, opacity: 0.85, fontWeight: '600' }}>★ {ag.r} · {ag.city}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
          <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '700', lineHeight: 17.4, maxWidth: 176, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 }}>{promo.headline}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 }}>
            <Text style={{ color: EX.color.ink, fontSize: 12.5, fontWeight: '700' }}>{promo.cta}</Text>
            <Ic.arrow size={14} color={EX.color.ink} strokeWidth={1.8} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// Small circular header button (message / bell) with unread dot.
function HeaderButton({ icon: IconCmp, onPress }: { icon: React.ComponentType<any>; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: EX.color.line10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <IconCmp size={19} color={EX.color.ink} strokeWidth={1.8} />
      <View style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 3.5, backgroundColor: EX.color.primary, borderWidth: 2, borderColor: '#fff' }} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const lead = APPS[0];
  const dLead = destById(lead.destId)!;
  const actionApp = APPS.find((a) => a.next.cta) ?? lead;
  const dAction = destById(actionApp.destId)!;
  const rec = DESTS.filter((d) => !APPS.some((a) => a.destId === d.id)).slice(0, 4);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: EX.color.bg }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 0 }}>
      {/* Greeting */}
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 22, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 13, color: EX.color.muted, fontWeight: '600' }}>Good morning</Text>
          <Text style={[displayText(27, 'semibold'), { marginTop: 2 }]}>{ME.name}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <HeaderButton icon={Ic.msg} onPress={() => router.push('/(explorer)/messages')} />
          <HeaderButton icon={Ic.bell} onPress={() => router.push('/(explorer)/notifications')} />
          <Pressable onPress={() => router.push('/(explorer)/(tabs)/profile')}>
            <Portrait seed={3} size={42} name="Alex K" />
          </Pressable>
        </View>
      </View>

      {/* HERO — application closest to the finish line */}
      <View style={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 4 }}>
        <Pressable
          onPress={() => router.push(`/(explorer)/application/${lead.id}`)}
          style={{ height: 210, borderRadius: 26, overflow: 'hidden', backgroundColor: dLead.tone, shadowColor: '#171326', shadowOpacity: 0.22, shadowRadius: 22, shadowOffset: { width: 0, height: 16 }, elevation: 7 }}
        >
          <Image source={{ uri: dLead.img }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} contentFit="cover" transition={200} />
          <LinearGradient
            colors={['rgba(12,10,8,0.8)', 'rgba(12,10,8,0.34)', 'rgba(12,10,8,0.12)']}
            locations={[0, 0.58, 1]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
          <View style={{ flex: 1, padding: 18, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <BlurView intensity={14} tint="light" style={{ overflow: 'hidden', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 11, paddingVertical: 6 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.44, textTransform: 'uppercase' }}>Closest to approval</Text>
              </BlurView>
              <BlurView intensity={14} tint="dark" style={{ width: 34, height: 34, borderRadius: 17, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(20,16,12,0.24)', alignItems: 'center', justifyContent: 'center' }}>
                <Ic.arrowUR size={17} color="#fff" strokeWidth={1.8} />
              </BlurView>
            </View>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <Flag code={dLead.flag} size={18} radius={5} />
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,0.92)' }}>{dLead.country} · Ref {lead.ref}</Text>
              </View>
              <Text style={{ color: '#fff', fontFamily: EX.font.display.semibold, fontSize: 24, letterSpacing: -0.24, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12 }}>
                {dLead.visa}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <Progress value={lead.progress} height={6} color="#fff" track="rgba(255,255,255,0.25)" style={{ flex: 1 }} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{Math.round(lead.progress * 100)}% · {STATUS[lead.status].label}</Text>
              </View>
            </View>
          </View>
        </Pressable>
      </View>

      {/* Next-step nudge */}
      {actionApp.next.cta ? (
        <View style={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 2 }}>
          <Pressable
            onPress={() => router.push(`/(explorer)/application/${actionApp.id}`)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15, borderRadius: 20, backgroundColor: EX.color.ink, shadowColor: '#171326', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 16 }, elevation: 8 }}
          >
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Ic.upload size={20} color="#fff" strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>Action needed · {dAction.country}</Text>
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: '#fff' }} numberOfLines={1}>{actionApp.next.label}</Text>
            </View>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: EX.color.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Ic.chevR size={18} color="#fff" strokeWidth={1.8} />
            </View>
          </Pressable>
        </View>
      ) : null}

      {/* Quick actions */}
      <View style={{ flexDirection: 'row', gap: 11, paddingHorizontal: 22, paddingTop: 18 }}>
        <QuickAction icon={Ic.globe} label="Explore visas" tone={{ bg: EX.color.primaryTint10, fg: EX.color.primary }} onPress={() => router.push('/(explorer)/(tabs)/explore')} />
        <QuickAction icon={Ic.shield} label="Check eligibility" tone={{ bg: EX.color.tealTint14, fg: EX.color.success }} onPress={() => router.push({ pathname: '/(explorer)/eligibility', params: { dest: DESTS[0].id } })} />
        <QuickAction icon={Ic.users} label="Find an agent" tone={{ bg: EX.color.purpleTint, fg: EX.color.purple }} onPress={() => router.push('/(explorer)/(tabs)/agents')} />
      </View>

      {/* Active applications */}
      <View style={{ paddingHorizontal: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 26, marginBottom: 13, marginHorizontal: 2 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: EX.color.ink, letterSpacing: -0.18 }}>Active applications</Text>
          <Pressable onPress={() => router.push('/(explorer)/(tabs)/tracker')} hitSlop={8}>
            <Text style={{ color: EX.color.primary, fontSize: 13.5, fontWeight: '600' }}>See all</Text>
          </Pressable>
        </View>
        <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: EX.color.line06, borderRadius: 22, padding: 5, shadowColor: '#171326', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 }}>
          {APPS.map((a, i) => (
            <React.Fragment key={a.id}>
              {i > 0 ? <View style={{ height: 1, backgroundColor: EX.color.line06, marginHorizontal: 12 }} /> : null}
              <MiniAppRow appId={a.id} onPress={() => router.push(`/(explorer)/application/${a.id}`)} />
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* Partners near you — sponsored placement */}
      <View style={{ paddingHorizontal: 22 }}>
        <View style={{ marginTop: 26, marginBottom: 13, marginHorizontal: 2 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: EX.color.ink, letterSpacing: -0.18 }}>Partners near you</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 13, paddingHorizontal: 22, paddingBottom: 4 }}>
        {PROMOS.map((p) => (
          <PartnerCard key={p.id} promo={p} onPress={() => router.push(`/(explorer)/agency/${p.id}`)} />
        ))}
      </ScrollView>

      {/* Recommended */}
      <View style={{ paddingHorizontal: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 26, marginBottom: 13, marginHorizontal: 2 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: EX.color.ink, letterSpacing: -0.18 }}>Recommended for you</Text>
          <Pressable onPress={() => router.push('/(explorer)/(tabs)/explore')} hitSlop={8}>
            <Text style={{ color: EX.color.primary, fontSize: 13.5, fontWeight: '600' }}>Explore</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 13, paddingHorizontal: 22, paddingBottom: EX.space.tabClear }}>
        {rec.map((d) => (
          <RecoCard key={d.id} destId={d.id} onPress={() => router.push(`/(explorer)/destination/${d.id}`)} />
        ))}
      </ScrollView>
    </ScrollView>
  );
}
