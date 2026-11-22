// ─────────────────────────────────────────────────────────────────────────────
// Saved destinations (profile → saved secondary destination).
//
// japa#146: the live saved list (GET /users/me/saved-destinations, shared
// query key with the destination heart and Profile), newest first, as the
// Explore 2-column Tile grid (regular tiles only — no `big` lead tile, its
// "MOST POPULAR" overline would be untrue here). Tap → that destination.
//
// States (#145 / #146 design specs):
//   • first load, nothing cached → coral spinner (StateLoading)
//   • loaded, none saved         → `bookmark` · "Nothing saved yet" · "Destinations
//                                   you save will show up here." · coral
//                                   "Explore destinations" → the Explore tab
//   • failed, nothing cached     → InlineError + "Try again" (StateError)
//   • cached + failed refetch    → the grid stays, no error
// Coming back after a save / remove elsewhere shows it at once: the writes
// edit the shared cache optimistically (no spinner flash).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// japa#474: shared pull-to-refresh (coral spinner, also re-reads the plan).
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { EX, displayText } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import {
  StateEmpty,
  StateError,
  StateLoading,
  loadErrorCopy,
  queryState,
} from '@/components/explorer/states';
import { Tile } from '@/components/explorer/Tile';
import { visaTypeToDest } from '@/components/explorer/liveExplore';
import { savedVisaAsVisaType } from '@/components/explorer/savedLogic';
import { useSavedDestinations } from '@/hooks/useSavedDestinations';
import type { Dest } from '@/types/explorer.type';

/** One grid cell: the tile, plus the route params to open it. */
interface SavedCell {
  key: string;
  dest: Dest;
  visaId: string;
  countryCode: string;
}

export default function SavedView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const savedQ = useSavedDestinations();
  const state = queryState(savedQ);

  // japa#474: pull-to-refresh re-reads the saved list and the plan.
  const pull = usePullToRefresh([savedQ]);

  // Each saved item → a Tile view model, in API order (newest first).
  const cells: SavedCell[] = useMemo(
    () =>
      (savedQ.data ?? []).map((item) => ({
        key: `${item.countryCode}_${item.visaId}`,
        dest: visaTypeToDest(savedVisaAsVisaType(item.visa), item.countryName),
        visaId: item.visaId,
        countryCode: item.countryCode,
      })),
    [savedQ.data],
  );

  // Open a saved destination (push from right, as everywhere).
  const open = (c: SavedCell) =>
    router.push({
      pathname: '/destination/[id]',
      params: { id: c.visaId, code: c.countryCode.toLowerCase() },
    });

  // Switch to the Explore tab with the selection haptic tab presses use.
  const toExplore = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(tabs)/explore');
  };

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
            accessibilityRole="button"
            accessibilityLabel="Back"
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
          <Text style={displayText(24, 'semibold')}>Saved destinations</Text>
        </View>
      </View>

      {state === 'loading' ? (
        <StateLoading />
      ) : state === 'error' ? (
        <StateError
          message={loadErrorCopy('your saved destinations')}
          onRetry={() => void savedQ.refetch()}
          retrying={savedQ.isRefetching}
        />
      ) : (
        // Up to 200 tiles, so a virtualised 2-column list. Same look as the
        // Explore grid: 22 sides, 48.4% cells, 13 between rows, an odd last
        // tile on the left.
        <FlatList
          data={cells}
          // japa#474: pull to refresh (old data stays while it runs).
          refreshControl={pull.control}
          keyExtractor={(c) => c.key}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          // Side padding on the rows (not the container), so the empty
          // state keeps its own full-width layout from #145.
          columnWrapperStyle={{
            justifyContent: 'space-between',
            paddingHorizontal: EX.space.screenX,
          }}
          ItemSeparatorComponent={RowGap}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={{ width: '48.4%' }}>
              <Tile d={item.dest} onPress={() => open(item)} />
            </View>
          )}
          ListEmptyComponent={
            // Loaded, none saved: the first-run empty state (#145).
            <StateEmpty
              icon={Ic.bookmark}
              title="Nothing saved yet"
              body="Destinations you save will show up here."
              action={{
                label: 'Explore destinations',
                onPress: toExplore,
                variant: 'coral',
              }}
            />
          }
        />
      )}
    </View>
  );
}

/** 13pt between grid rows (Explore's `rowGap`). */
function RowGap() {
  return <View style={{ height: 13 }} />;
}
