// ─────────────────────────────────────────────────────────────────────────────
// Explore — editorial, image-led destination grid (prototype grid.jsx GridView).
// Sticky glass header (greeting + search + category chips) over a featured tile
// and a 2-column grid of uniform destination tiles.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import type { Dest } from '@/types/explorer.type';
import {
  mapVisasToDests,
  visaTypeToDest,
} from '@/components/explorer/liveExplore';
import {
  useCountriesWithVisas,
  useVisaSearch,
  useVisaTypes,
} from '@/hooks/useVisaTypes';
import { Ic } from '@/components/explorer/icons';
import { Portrait } from '@/components/explorer/primitives';
import { Tile } from '@/components/explorer/Tile';
// japa#145: shared loading / empty / error states (live only).
import {
  StateEmpty,
  StateError,
  StateLoading,
  loadErrorCopy,
  queryState,
} from '@/components/explorer/states';
// japa#145: the greeting + portrait use the signed-in user's real name.
import { useMe } from '@/hooks/useMe';
import { profileName, profileSeed } from '@/components/explorer/liveProfile';

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cat, setCat] = useState('All');

  // ── Live data (GET /visas + /countries) ─────────────────────────────────
  // japa#145: no sample destinations. The grid shows the backend's visas, or a
  // loading / empty / error state (spec section 2, Explore row).
  const visaQuery = useVisaTypes({ limit: 60 });
  const { data: countries } = useCountriesWithVisas();
  const source = useMemo(() => {
    const visas = visaQuery.data?.visaTypes ?? [];
    return mapVisasToDests(visas, countries ?? []);
  }, [visaQuery.data, countries]);
  // 'loading' (first load, nothing cached) | 'error' (failed, nothing cached)
  // | 'ready'. A background refetch with cached rows stays silent.
  const state = queryState(visaQuery);
  // First-run empty: the source has no destinations at all.
  const firstRunEmpty = state === 'ready' && source.length === 0;

  // ── Signed-in user (GET /users/me) for the greeting + portrait ────────────
  const { data: me } = useMe();
  const myName = profileName(me);
  const firstName = myName.split(' ')[0];

  // ── Search (GET /visas/search, active at ≥2 chars) — overrides browse view ──
  const [query, setQuery] = useState('');
  const searchQ = useVisaSearch(query.trim());
  const searchResults = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return null;
    return (searchQ.data ?? []).map((v) =>
      visaTypeToDest(
        v,
        countries?.find(
          (c) => c.code.toLowerCase() === (v.countryCode ?? '').toLowerCase(),
        )?.name,
      ),
    );
  }, [query, searchQ.data, countries]);
  const searchMode = searchResults !== null;

  // Category chips derive from whatever data is showing.
  const cats = useMemo(
    () => ['All', ...Array.from(new Set(source.map((d) => d.cat)))],
    [source],
  );

  const list = source.filter((d) => cat === 'All' || d.cat === cat);
  const featured = list.find((d) => d.featured) ?? list[0];
  const rest = list.filter((d) => d !== featured);
  // Pass the country code so the detail screen can fetch the visa by
  // (countryCode, visaId).
  const open = (dd: Dest) =>
    router.push({
      pathname: '/destination/[id]',
      params: { id: dd.id, code: dd.flag },
    });

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      <ScrollView
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: EX.space.tabClear }}
        refreshControl={
          <RefreshControl
            refreshing={visaQuery.isRefetching}
            onRefresh={() => visaQuery.refetch()}
            tintColor={EX.color.primary}
          />
        }
      >
        {/* ── Sticky glass header ─────────────────────────────────────────── */}
        <BlurView
          intensity={40}
          tint="light"
          style={{
            paddingTop: insets.top + 6,
            backgroundColor: EX.color.glassWarm,
            borderBottomWidth: 1,
            borderBottomColor: EX.color.line06,
          }}
        >
          <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <View>
                {/* Real first name when the profile has one; "Good morning"
                    alone otherwise (never a persona). */}
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 12.5,
                    color: EX.color.muted,
                    fontWeight: '600',
                  }}
                >
                  {firstName ? `Good morning, ${firstName}` : 'Good morning'}
                </Text>
                <Text style={[displayText(30, 'semibold'), { marginTop: 2 }]}>
                  Where to next?
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => router.push('/notifications')}
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
                  <Ic.bell size={19} color={EX.color.ink} strokeWidth={1.8} />
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
                </Pressable>
                <Pressable
                  onPress={() => router.push('/(tabs)/profile')}
                  style={{ borderRadius: 21 }}
                >
                  <Portrait
                    seed={profileSeed(me)}
                    size={42}
                    name={myName || ' '}
                  />
                </Pressable>
              </View>
            </View>

            {/* Search — live GET /visas/search once ≥2 chars are typed */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: EX.color.line10,
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 4,
              }}
            >
              <Ic.search size={18} color={EX.color.muted} strokeWidth={1.8} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search countries or visas"
                placeholderTextColor={EX.color.muted}
                returnKeyType="search"
                autoCorrect={false}
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: EX.color.ink,
                  paddingVertical: 10,
                }}
              />
              {query.length ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ic.x size={18} color={EX.color.muted} strokeWidth={1.8} />
                </Pressable>
              ) : (
                <Ic.sliders size={18} color={EX.color.ink} strokeWidth={1.8} />
              )}
            </View>
          </View>

          {/* Category chips — hidden while searching, and on first-run empty /
              loading / error, where they would mean nothing (spec 1.2). */}
          {!searchMode && state === 'ready' && !firstRunEmpty ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: 8,
                paddingHorizontal: 20,
                paddingBottom: 14,
              }}
            >
              {cats.map((c) => {
                const on = cat === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCat(c)}
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
                        color: on ? EX.color.bg : EX.color.ink2,
                      }}
                    >
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </BlurView>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          {searchMode ? (
            searchResults!.length ? (
              <>
                <Text
                  style={{
                    fontSize: 12.5,
                    color: EX.color.muted,
                    fontWeight: '600',
                    marginBottom: 12,
                  }}
                >
                  {searchResults!.length} result
                  {searchResults!.length === 1 ? '' : 's'} for “{query.trim()}”
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    rowGap: 13,
                  }}
                >
                  {searchResults!.map((d) => (
                    <View key={d.id} style={{ width: '48.4%' }}>
                      <Tile d={d} onPress={() => open(d)} />
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={{ paddingTop: 50, alignItems: 'center' }}>
                {searchQ.isFetching ? (
                  <ActivityIndicator color={EX.color.primary} />
                ) : (
                  <>
                    <Ic.search
                      size={34}
                      color={EX.color.muted}
                      strokeWidth={1.5}
                      style={{ opacity: 0.5, marginBottom: 10 }}
                    />
                    <Text style={{ color: EX.color.muted, fontSize: 14 }}>
                      No visas match “{query.trim()}”
                    </Text>
                  </>
                )}
              </View>
            )
          ) : state === 'loading' ? (
            // First load, nothing cached: the coral spinner.
            <StateLoading />
          ) : state === 'error' ? (
            // Load failed, nothing cached: InlineError + Outline "Try again".
            <StateError
              section
              message={loadErrorCopy('destinations')}
              onRetry={() => visaQuery.refetch()}
              retrying={visaQuery.isRefetching}
            />
          ) : firstRunEmpty ? (
            <StateEmpty
              icon={Ic.globe}
              title="No destinations yet"
              body="We’re adding new visas all the time. Check back soon."
            />
          ) : (
            <>
              {featured ? (
                <View style={{ marginBottom: 14 }}>
                  <Tile d={featured} big onPress={() => open(featured)} />
                </View>
              ) : null}

              {/* 2-column grid */}
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  rowGap: 13,
                }}
              >
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
