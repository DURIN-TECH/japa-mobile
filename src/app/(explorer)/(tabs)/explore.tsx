// ─────────────────────────────────────────────────────────────────────────────
// Explore — editorial, image-led destination grid (prototype grid.jsx GridView).
// Sticky glass header (greeting + search + category chips) over a featured tile
// and a 2-column grid of uniform destination tiles.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { DESTS, Dest } from '@/components/explorer/data';
import { mapVisasToDests } from '@/components/explorer/liveExplore';
import { useCountriesWithVisas, useVisaTypes } from '@/hooks/useVisaTypes';
import { Ic } from '@/components/explorer/icons';
import { Portrait } from '@/components/explorer/primitives';
import { Tile } from '@/components/explorer/Tile';

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cat, setCat] = useState('All');

  // ── Live data (GET /visas + /countries) with a demo fallback ──────────────
  const visaQuery = useVisaTypes({ limit: 60 });
  const { data: countries } = useCountriesWithVisas();
  const liveDests = useMemo(() => {
    const visas = visaQuery.data?.visaTypes ?? [];
    return visas.length ? mapVisasToDests(visas, countries ?? []) : [];
  }, [visaQuery.data, countries]);
  const usingLive = liveDests.length > 0;
  const source = usingLive ? liveDests : DESTS;
  const initialLoading = visaQuery.isLoading && !usingLive;

  // Category chips derive from whatever data is showing.
  const cats = useMemo(() => ['All', ...Array.from(new Set(source.map((d) => d.cat)))], [source]);

  const list = source.filter((d) => cat === 'All' || d.cat === cat);
  const featured = list.find((d) => d.featured) ?? list[0];
  const rest = list.filter((d) => d !== featured);
  // Pass the country code so the detail screen can fetch live visa data by
  // (countryCode, visaId). Demo tiles ignore it (resolved from static DESTS).
  const open = (dd: Dest) => router.push({ pathname: '/(explorer)/destination/[id]', params: { id: dd.id, code: dd.flag } });

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      <ScrollView
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: EX.space.tabClear }}
        refreshControl={
          <RefreshControl
            refreshing={visaQuery.isFetching && usingLive}
            onRefresh={() => visaQuery.refetch()}
            tintColor={EX.color.primary}
          />
        }
      >
        {/* ── Sticky glass header ─────────────────────────────────────────── */}
        <BlurView
          intensity={40}
          tint="light"
          style={{ paddingTop: insets.top + 6, backgroundColor: EX.color.glassWarm, borderBottomWidth: 1, borderBottomColor: EX.color.line06 }}
        >
          <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View>
                <Text style={{ fontSize: 12.5, color: EX.color.muted, fontWeight: '600' }}>Good morning, Alex</Text>
                <Text style={[displayText(30, 'semibold'), { marginTop: 2 }]}>Where to next?</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => router.push('/(explorer)/notifications')}
                  style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: EX.color.line10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ic.bell size={19} color={EX.color.ink} strokeWidth={1.8} />
                  <View style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 3.5, backgroundColor: EX.color.primary, borderWidth: 2, borderColor: '#fff' }} />
                </Pressable>
                <Pressable onPress={() => router.push('/(explorer)/(tabs)/profile')} style={{ borderRadius: 21 }}>
                  <Portrait seed={3} size={42} name="Alex K" />
                </Pressable>
              </View>
            </View>

            {/* Search (tappable — opens a real search later) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: EX.color.line10, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12 }}>
              <Ic.search size={18} color={EX.color.muted} strokeWidth={1.8} />
              <Text style={{ fontSize: 14, color: EX.color.muted, flex: 1 }}>Search countries or visas</Text>
              <Ic.sliders size={18} color={EX.color.ink} strokeWidth={1.8} />
            </View>
          </View>

          {/* Category chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 14 }}
          >
            {cats.map((c) => {
              const on = cat === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCat(c)}
                  style={{
                    borderWidth: 1, borderColor: on ? EX.color.ink : EX.color.line12,
                    backgroundColor: on ? EX.color.ink : '#fff', borderRadius: 999,
                    paddingHorizontal: 16, paddingVertical: 8,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: on ? EX.color.bg : EX.color.ink2 }}>{c}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </BlurView>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          {initialLoading ? (
            <View style={{ paddingTop: 60, alignItems: 'center' }}>
              <ActivityIndicator color={EX.color.primary} />
              <Text style={{ marginTop: 12, color: EX.color.muted, fontSize: 13.5 }}>Loading visas…</Text>
            </View>
          ) : (
            <>
              {/* Fallback notice when the backend returned nothing (offline / empty). */}
              {!usingLive ? (
                <View style={{ marginBottom: 12, backgroundColor: EX.color.cream, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 13 }}>
                  <Text style={{ fontSize: 12.5, color: EX.color.amber, fontWeight: '600' }}>
                    Showing sample destinations · pull to refresh for live visas
                  </Text>
                </View>
              ) : null}

              {featured ? (
                <View style={{ marginBottom: 14 }}>
                  <Tile d={featured} big onPress={() => open(featured)} />
                </View>
              ) : null}

              {/* 2-column grid */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 13 }}>
                {rest.map((d) => (
                  <View key={d.id} style={{ width: '48.4%' }}>
                    <Tile d={d} onPress={() => open(d)} />
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
