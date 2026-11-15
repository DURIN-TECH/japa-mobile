// ─────────────────────────────────────────────────────────────────────────────
// Explore — editorial, image-led destination grid (prototype grid.jsx GridView).
// Sticky glass header (greeting + search + category chips) over a featured tile
// and a 2-column grid of uniform destination tiles.
//
// japa#341: the browse grid pages through GET /visas (60 per request) instead
// of stopping at the first 60, so every visible visa can be reached by
// scrolling. A coral spinner / InlineError + "Try again" sit below the tiles
// while a later page loads or after it fails.
//
// japa#347: filters. The sliders button opens `ExploreFilterSheet` (visa type
// + country, multi-select). ONE `filters` state (see exploreFilters.ts) drives
// the category chips, the sheet, the coral dot, the "Filters · N" chip in
// search mode and the summary line. A filtered browse grid does not filter
// the loaded pages (that would hide matches on later pages): it fetches the
// complete candidate list (`useFilteredExploreVisas`) and narrows it. With no
// filter on, everything below behaves exactly as after #341.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Keyboard,
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
  dedupeVisaPages,
  destKey,
  type LoadTrigger,
  mapVisaPagesToDests,
  mapVisasToDests,
  type ScrollMetrics,
  shouldLoadNextPage,
  visaTypeToDest,
} from '@/components/explorer/liveExplore';
import {
  useCountriesWithVisas,
  useExploreVisaPages,
  useFilteredExploreVisas,
  useVisaSearch,
  useVisasForCountries,
} from '@/hooks/useVisaTypes';
// japa#347: filter state rules + the sheet.
import {
  ALL_CATEGORY_LABELS,
  EMPTY_FILTERS,
  FILTER_COPY,
  applyFilters,
  chipCategories,
  clearFilters,
  filterA11yLabel,
  filterChipLabel,
  filterCount,
  filterFetchPlan,
  isChipSelected,
  resultsLine,
  sheetCategories,
  summaryLine,
  tapCategoryChip,
  type ExploreFilters,
} from '@/components/explorer/exploreFilters';
import {
  ExploreFilterChip,
  ExploreFilterSheet,
} from '@/components/explorer/ExploreFilterSheet';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { TextLink } from '@/components/explorer/HoldingsParts';
import { matchCountries, mergeSearchVisas } from '@/utils/countrySearch';
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

  // ── Filters (japa#347) ────────────────────────────────────────────────────
  // In memory only: reset on app restart. Replaces the old single `cat`
  // state; chip "All" is selected exactly when `filters.categories` is empty.
  const [filters, setFilters] = useState<ExploreFilters>(EMPTY_FILTERS);
  const nFilters = filterCount(filters);
  const filtersOn = nFilters > 0;
  const [sheetOpen, setSheetOpen] = useState(false);

  // ── Live data (GET /visas + /countries) ─────────────────────────────────
  // japa#145: no sample destinations. The grid shows the backend's visas, or a
  // loading / empty / error state (spec section 2, Explore row).
  // japa#341: paged — page one is `limit=60&offset=0`, each later page asks
  // for the next 60 from `offset` = visas loaded so far, until `total`.
  const visaQuery = useExploreVisaPages();
  const { data: countries } = useCountriesWithVisas();
  // All loaded pages → tiles, de-duplicated by country code + visa id, with
  // the featured tile fixed from page one (see liveExplore.ts, japa#341).
  const source = useMemo(() => {
    const pages = (visaQuery.data?.pages ?? []).map((p) => p.visaTypes ?? []);
    return mapVisaPagesToDests(pages, countries ?? []);
  }, [visaQuery.data, countries]);
  // 'loading' (first load, nothing cached) | 'error' (failed, nothing cached)
  // | 'ready'. A background refetch with cached rows stays silent.
  const state = queryState(visaQuery);
  // First-run empty: the source has no destinations at all. Only without
  // filters: a filtered grid has its own "no match" state.
  const firstRunEmpty = !filtersOn && state === 'ready' && source.length === 0;

  // ── Filtered browse list (japa#347) ───────────────────────────────────────
  // The complete candidates for the chosen countries / categories (see
  // `filterFetchPlan`), narrowed by the exact OR / AND rule. No request at
  // all while no filter is on.
  const fetchPlan = useMemo(() => filterFetchPlan(filters), [filters]);
  const filteredQ = useFilteredExploreVisas(fetchPlan);
  const filteredDests = useMemo(
    () =>
      applyFilters(
        // De-duplicated by country code + visa id, lead tile featured.
        mapVisasToDests(
          dedupeVisaPages([filteredQ.data ?? []]),
          countries ?? [],
        ),
        filters,
      ),
    [filteredQ.data, countries, filters],
  );
  // The state the browse body renders: the filtered query's while filters
  // are on, the paged list's otherwise.
  const browseState = filtersOn ? queryState(filteredQ) : state;
  // Code → country name, for the summary line.
  const countryName = useCallback(
    (code: string) =>
      countries?.find((c) => c.code.toUpperCase() === code.toUpperCase())?.name,
    [countries],
  );

  // ── Signed-in user (GET /users/me) for the greeting + portrait ────────────
  const { data: me } = useMe();
  const myName = profileName(me);
  const firstName = myName.split(' ')[0];

  // ── Search (GET /visas/search, active at ≥2 chars) — overrides browse view ──
  const [query, setQuery] = useState('');
  const searchQ = useVisaSearch(query.trim());
  // japa#254: also resolve the query to countries (name / alias / code) and
  // fetch THEIR visas, so typing "UK" or "ire" lists that country's visas.
  // (Not filtered from the browse list: that is loaded page by page as the
  // user scrolls (japa#341), so it may not hold every visa yet.)
  const matchedCountries = useMemo(
    () => matchCountries(query, countries ?? []),
    [query, countries],
  );
  const countryVisas = useVisasForCountries(
    matchedCountries.map((c) => c.code),
  );
  const searchResults = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return null;
    // Name matches + matched countries' visas, each visa listed once, then
    // narrowed by the filters (japa#347), so the results line counts only
    // what matches.
    const all = mergeSearchVisas(searchQ.data ?? [], countryVisas.visas).map(
      (v) =>
        visaTypeToDest(
          v,
          countries?.find(
            (c) => c.code.toLowerCase() === (v.countryCode ?? '').toLowerCase(),
          )?.name,
        ),
    );
    return applyFilters(all, filters);
  }, [query, searchQ.data, countryVisas.visas, countries, filters]);
  const searchMode = searchResults !== null;

  // Category chips derive from ALL loaded pages, so a category first seen on a
  // later page gets its chip once that page arrives (japa#341). A chosen
  // category not seen yet keeps its chip (japa#347), so it never disappears.
  const seenCats = useMemo(
    () => Array.from(new Set(source.map((d) => d.cat))),
    [source],
  );
  const cats = useMemo(
    () => chipCategories(seenCats, filters.categories),
    [seenCats, filters.categories],
  );
  // The sheet's "Visa type" options: the same list without "All". Before any
  // visa has loaded, every known category, so the group is never empty.
  const sheetCats = useMemo(() => {
    const list = sheetCategories(seenCats, filters.categories);
    return list.length ? list : ALL_CATEGORY_LABELS;
  }, [seenCats, filters.categories]);

  const list = filtersOn ? filteredDests : source;
  const featured = list.find((d) => d.featured) ?? list[0];
  const rest = list.filter((d) => d !== featured);
  // ── Paging: load the next page near the end (japa#341) ──────────────────
  // The grid is a ScrollView (sticky glass header), not a FlatList, so "near
  // the end" is measured by hand: the latest scroll offset, viewport height
  // and content height live in a ref, and `maybeLoadMore(trigger)` asks the
  // pure `shouldLoadNextPage` rule whether to fetch. Who may trigger what
  // (review of japa#341, rules + tests in liveExplore):
  //   • "All": only scroll and content-size events, near the end of measured
  //     content. Never the effect or a layout event, which can still hold the
  //     content height of the previous content (first-load spinner, search
  //     results, 0 on a cached mount) and would load page two unscrolled.
  //   • filters on (japa#347): never. The filtered grid has its own complete
  //     list, so the paged one stays as it is (the old "category chip" case
  //     of `shouldLoadNextPage` is no longer reached from here).
  // Every load goes through `loadNextPage()`, which checks the LIVE fetch
  // status and never cancels a request in flight, so several triggers from
  // one render ask for a page once.
  const metrics = useRef<ScrollMetrics>({
    offsetY: 0,
    viewportHeight: 0,
    contentHeight: 0,
  });
  const {
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    isRefreshing,
    loadNextPage,
  } = visaQuery;
  const maybeLoadMore = useCallback(
    (trigger: LoadTrigger) => {
      // Wait for the first page (and its first-load states) before paging.
      if (state !== 'ready' || firstRunEmpty) return;
      // A filtered grid is complete already: no paging behind it.
      if (filtersOn) return;
      const go = shouldLoadNextPage({
        trigger,
        searchMode,
        hasNextPage,
        // Our pull-to-refresh fetches page one outside the query, so count
        // it as in flight too.
        isFetching: isFetching || isRefreshing,
        nextPageFailed: isFetchNextPageError,
        // Unfiltered here (see above), i.e. the "All" rule.
        category: 'All',
        metrics: metrics.current,
      });
      if (go) loadNextPage();
    },
    [
      state,
      firstRunEmpty,
      filtersOn,
      searchMode,
      hasNextPage,
      isFetching,
      isRefreshing,
      isFetchNextPageError,
      loadNextPage,
    ],
  );
  // Kept from #341: under the "All" rule the 'effect' trigger never loads,
  // so this is inert today; left so the paging contract stays in one place.
  useEffect(() => {
    maybeLoadMore('effect');
  }, [maybeLoadMore]);

  // ── Filter actions (japa#347) ─────────────────────────────────────────────
  const scrollRef = useRef<ScrollView>(null);
  const chipRowRef = useRef<ScrollView>(null);
  // x of each chip in the chip row, from onLayout, to scroll the first chosen
  // chip into view after the sheet applies.
  const chipX = useRef<Record<string, number>>({});

  /** Filter button / "Filters" chip: dismiss the keyboard, open the sheet. */
  const openSheet = () => {
    Keyboard.dismiss();
    setSheetOpen(true);
  };
  /** "Show visas": apply the draft, scroll Explore to the top. */
  const applySheet = (draft: ExploreFilters) => {
    setFilters(draft);
    setSheetOpen(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    // After the chip row re-renders with the new choice: bring the first
    // chosen chip (in row order) into view.
    setTimeout(() => {
      const first = chipCategories(seenCats, draft.categories)
        .slice(1)
        .find((c) => draft.categories.includes(c));
      const x = first ? chipX.current[first] : 0;
      chipRowRef.current?.scrollTo({
        x: Math.max(0, (x ?? 0) - 20),
        animated: true,
      });
    }, 50);
  };
  /** "Clear filters" (summary link and empty states): both groups. */
  const clearAll = () => setFilters(clearFilters());

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
        ref={scrollRef}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        // japa#347: the first tap on the "x", a chip or a tile acts even with
        // the keyboard open (otherwise it only dismisses the keyboard).
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: EX.space.tabClear }}
        scrollEventThrottle={100}
        onScroll={(e) => {
          const { contentOffset, layoutMeasurement, contentSize } =
            e.nativeEvent;
          metrics.current = {
            offsetY: contentOffset.y,
            viewportHeight: layoutMeasurement.height,
            contentHeight: contentSize.height,
          };
          maybeLoadMore('scroll');
        }}
        onLayout={(e) => {
          metrics.current.viewportHeight = e.nativeEvent.layout.height;
          maybeLoadMore('layout');
        }}
        onContentSizeChange={(_w, h) => {
          metrics.current.contentHeight = h;
          maybeLoadMore('contentSize');
        }}
        refreshControl={
          <RefreshControl
            // Only the pull itself shows the refresh spinner: loading a later
            // page also counts as "refetching" in TanStack Query.
            // `isRefreshing` = our page-one refresh with pages cached;
            // `isRefetching` covers a pull with nothing cached yet.
            // japa#347: with filters on (browse), the pull refetches the
            // filtered list and the filters stay applied.
            refreshing={
              filtersOn && !searchMode
                ? filteredQ.isRefetching
                : isRefreshing ||
                  (visaQuery.isRefetching && !isFetchingNextPage)
            }
            // japa#341: start over from page one and drop the later pages.
            onRefresh={() =>
              filtersOn && !searchMode
                ? filteredQ.refetch()
                : visaQuery.refreshFromFirstPage()
            }
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
                // Right padding 0 (japa#347): the 44×44 button box sits on
                // the pill's right edge, keeping the pill about 46 tall.
                paddingLeft: 16,
                paddingRight: 0,
                paddingVertical: 0,
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
              {/* japa#347: both controls share one 44×44 spot. Text typed →
                  the "x" (one tap clears; keyboard may stay open). Empty →
                  the filter button, with a coral dot when filters are on. */}
              {query.length ? (
                <PressableStatic
                  onPress={() => setQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel={FILTER_COPY.clearSearch}
                  style={({ pressed }) => ({
                    width: 44,
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Ic.x size={18} color={EX.color.muted} strokeWidth={1.8} />
                </PressableStatic>
              ) : (
                <PressableStatic
                  onPress={openSheet}
                  accessibilityRole="button"
                  accessibilityLabel={filterA11yLabel(nFilters)}
                  style={({ pressed }) => ({
                    width: 44,
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Ic.sliders
                    size={18}
                    color={EX.color.ink}
                    strokeWidth={1.8}
                  />
                  {filtersOn ? (
                    // Same dot as the bell's unread dot in this header.
                    <View
                      style={{
                        position: 'absolute',
                        top: 9,
                        right: 9,
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: EX.color.primary,
                        borderWidth: 2,
                        borderColor: EX.color.cardWhite,
                      }}
                    />
                  ) : null}
                </PressableStatic>
              )}
            </View>
          </View>

          {/* Search mode (japa#347): the chip row is hidden, so one
              "Filters" chip keeps the sheet reachable. Selected look (and
              "Filters · N") while filters are on. */}
          {searchMode ? (
            <View
              style={{
                flexDirection: 'row',
                paddingHorizontal: 20,
                // Room for the chip's 6 pt top hit slop (see the chip row).
                marginTop: -6,
                paddingTop: 6,
                paddingBottom: 14,
              }}
            >
              <ExploreFilterChip
                label={filterChipLabel(nFilters)}
                selected={filtersOn}
                icon={Ic.sliders}
                accessibilityLabel={filterA11yLabel(nFilters)}
                onPress={openSheet}
              />
            </View>
          ) : null}

          {/* Category chips — hidden while searching, and on first-run empty /
              loading / error, where they would mean nothing (spec 1.2). */}
          {!searchMode && state === 'ready' && !firstRunEmpty ? (
            <ScrollView
              ref={chipRowRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              // 6 pt of room above the chips (pulled back up by the negative
              // margin) so their 6 pt top hit slop stays inside the row:
              // touches outside a parent's bounds are never delivered.
              style={{ marginTop: -6 }}
              contentContainerStyle={{
                gap: 8,
                paddingHorizontal: 20,
                paddingTop: 6,
                paddingBottom: 14,
              }}
            >
              {/* japa#347: chips share `filters.categories` with the sheet.
                  "All" clears; any other chip adds or removes itself, and
                  every chosen chip is drawn selected at once. */}
              {cats.map((c) => (
                <View
                  key={c}
                  onLayout={(e) => {
                    chipX.current[c] = e.nativeEvent.layout.x;
                  }}
                >
                  <ExploreFilterChip
                    label={c}
                    selected={isChipSelected(filters, c)}
                    onPress={() => setFilters((f) => tapCategoryChip(f, c))}
                  />
                </View>
              ))}
            </ScrollView>
          ) : null}
        </BlurView>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          {searchMode ? (
            searchResults!.length ? (
              <>
                {/* Counts the FILTERED results (japa#347). ink-muted, not
                    muted: muted text fails contrast on bg. */}
                <Text
                  style={{
                    fontSize: 12.5,
                    color: EX.color.inkMuted,
                    fontWeight: '600',
                    marginBottom: 12,
                  }}
                >
                  {resultsLine(searchResults!.length, query.trim())}
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
            ) : searchQ.isFetching || countryVisas.isFetching ? (
              <View style={{ paddingTop: 50, alignItems: 'center' }}>
                <ActivityIndicator color={EX.color.primary} />
              </View>
            ) : filtersOn ? (
              // Search + filters, nothing left: say the filters did it, and
              // offer to clear them (the query is kept).
              <StateEmpty
                icon={Ic.sliders}
                title={FILTER_COPY.emptySearchTitle(query.trim())}
                body={FILTER_COPY.emptySearchBody}
                action={{
                  label: FILTER_COPY.clearFilters,
                  onPress: clearAll,
                  variant: 'outline',
                }}
              />
            ) : (
              // No filters: today's no-match line, unchanged.
              <View style={{ paddingTop: 50, alignItems: 'center' }}>
                <Ic.search
                  size={34}
                  color={EX.color.muted}
                  strokeWidth={1.5}
                  style={{ opacity: 0.5, marginBottom: 10 }}
                />
                <Text style={{ color: EX.color.muted, fontSize: 14 }}>
                  No visas match “{query.trim()}”
                </Text>
              </View>
            )
          ) : (
            <>
              {/* ── Summary line (japa#347): browse with filters on ─────────
                  "Showing Work visas in Canada" + "Clear filters", so a
                  filtered grid never looks like the full list. */}
              {filtersOn ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <Text
                    numberOfLines={2}
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      fontWeight: '600',
                      lineHeight: 18,
                      color: EX.color.inkMuted,
                    }}
                  >
                    {summaryLine(filters, countryName)}
                  </Text>
                  <TextLink
                    label={FILTER_COPY.clearFilters}
                    onPress={clearAll}
                    size={13.5}
                  />
                </View>
              ) : null}

              {browseState === 'loading' ? (
                // First load, nothing cached: the coral spinner.
                <StateLoading />
              ) : browseState === 'error' ? (
                // Load failed, nothing cached: InlineError + Outline "Try
                // again" (the filtered list's own refetch when filtered).
                <StateError
                  section
                  message={loadErrorCopy('destinations')}
                  onRetry={() =>
                    filtersOn ? filteredQ.refetch() : visaQuery.refetch()
                  }
                  retrying={
                    filtersOn ? filteredQ.isRefetching : visaQuery.isRefetching
                  }
                />
              ) : firstRunEmpty ? (
                <StateEmpty
                  icon={Ic.globe}
                  title="No destinations yet"
                  body="We’re adding new visas all the time. Check back soon."
                />
              ) : filtersOn && list.length === 0 ? (
                // Filtered, no match: icon + one line + "Clear filters".
                // Outline: the summary above already has the coral link.
                <StateEmpty
                  icon={Ic.sliders}
                  title={FILTER_COPY.emptyBrowseTitle}
                  body={FILTER_COPY.emptyBrowseBody}
                  action={{
                    label: FILTER_COPY.clearFilters,
                    onPress: clearAll,
                    variant: 'outline',
                  }}
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
                      // Keyed by country code + visa id: visa ids are only
                      // unique within a country (japa#341).
                      <View key={destKey(d)} style={{ width: '48.4%' }}>
                        <Tile d={d} onPress={() => open(d)} />
                      </View>
                    ))}
                  </View>

                  {/* ── Paging footer (japa#341) ─────────────────────────
                      Loading a later page: the coral spinner under the last
                      tile. That page failed: InlineError + "Try again",
                      which retries that page only (`loadNextPage` resumes
                      from the same offset). Loaded tiles stay above in both
                      cases. When everything is loaded, nothing shows. A
                      filtered grid is complete, so it has no footer. */}
                  {filtersOn ? null : isFetchingNextPage ? (
                    <StateLoading section />
                  ) : isFetchNextPageError && hasNextPage ? (
                    <StateError
                      section
                      style={{ marginTop: 16 }}
                      message={loadErrorCopy('destinations')}
                      // Same guarded call: retries that offset once.
                      onRetry={loadNextPage}
                    />
                  ) : null}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* ── Filter sheet (japa#347) ─────────────────────────────────────────
          Mounted only while open, so each opening starts from a fresh draft
          (a copy of `filters`). "Show visas" applies it; any other close
          throws it away. */}
      {sheetOpen ? (
        <ExploreFilterSheet
          filters={filters}
          categories={sheetCats}
          onApply={applySheet}
          onDismiss={() => setSheetOpen(false)}
        />
      ) : null}
    </View>
  );
}
