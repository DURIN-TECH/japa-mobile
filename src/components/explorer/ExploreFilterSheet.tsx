// ─────────────────────────────────────────────────────────────────────────────
// ExploreFilterSheet (japa#347) — the slide-up filter sheet over Explore.
//
// An in-screen modal sheet, not a route, so Explore stays visible behind it.
// Layout, copy and motion follow the design spec on the issue:
//
//   backdrop (EXScrim.sheet, tap = close)
//   card: grab bar · "Filters" + close circle
//         scrolling body: "Visa type" chips · "Country" search + rows
//         fixed footer: Outline "Clear all" · Coral "Show visas"
//
// DRAFT STATE: the sheet works on a copy of the applied filters taken when it
// opens. Taps change only the draft. "Show visas" hands the draft back
// (`onApply`); every other way of closing (close circle, backdrop, swipe
// down, Android back) throws it away (`onDismiss`), so applied filters never
// change by accident. "Clear all" empties the draft only.
//
// The parent MOUNTS this only while it is open, so each opening starts from
// a fresh draft and a freshly ordered country list (chosen first).
//
// MOTION: a transparent Modal with animationType="none"; the card and the
// backdrop are animated here (a 'slide' Modal would move the backdrop with
// the card). Open 320 ms slide + 280 ms fade, close 240 ms, on the system's
// one curve. Reduced motion: a 200 ms fade of both, no slide. Drag to close
// on the grab bar / title row, and on the body when it is scrolled to the
// top; release past 25% of the height or faster than 1000 pt/s closes,
// otherwise it settles back.
//
// Pressables get static styles through PressableStatic (the function-style
// `style` renders unstyled under NativeWind css-interop).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { Ic } from '@/components/explorer/icons';
import { Flag, SectionTitle } from '@/components/explorer/primitives';
import {
  StateError,
  StateLoading,
  loadErrorCopy,
  queryState,
} from '@/components/explorer/states';
import {
  EX,
  EXScrim,
  EXShadow,
  displayText,
} from '@/components/explorer/theme';
import {
  FILTER_COPY as C,
  chosenLabel,
  clearFilters,
  filterCount,
  orderSheetCountries,
  searchSheetCountries,
  toggleCategory,
  toggleCountry,
  visaCountLabel,
  type ExploreFilters,
} from '@/components/explorer/exploreFilters';
import { useCountriesWithVisas } from '@/hooks/useVisaTypes';

// ── Motion constants (spec "Motion") ─────────────────────────────────────────
/** The system's one curve, as in primitives.tsx. */
const CURVE = Easing.bezier(0.2, 0.8, 0.2, 1);
const OPEN_SLIDE_MS = 320;
const OPEN_FADE_MS = 280;
const CLOSE_MS = 240;
const REDUCED_MS = 200;
/** Release past this share of the card's height closes the sheet. */
const CLOSE_DISTANCE = 0.25;
/** …or a downward fling faster than this (pt/s). */
const CLOSE_VELOCITY = 1000;

// ── FilterChip ───────────────────────────────────────────────────────────────
// The system's FilterChip look (ink fill when selected), as Explore's category
// chips already draw it: 13/600 label, pill, ~33 tall with 6 pt vertical hit
// slop so the tap area is above 44 pt. Exported for the Explore screen's chip
// row and its search-mode "Filters" chip.
export function ExploreFilterChip({
  label,
  selected,
  onPress,
  icon: IconCmp,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Optional leading icon (15 px), e.g. the sliders on the "Filters" chip. */
  icon?: React.ElementType;
  /** Defaults to the label. */
  accessibilityLabel?: string;
}) {
  const fg = selected ? EX.color.bg : EX.color.ink2;
  return (
    <PressableStatic
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: selected ? EX.color.ink : EX.color.line12,
        backgroundColor: selected ? EX.color.ink : EX.color.cardWhite,
        borderRadius: EX.radius.pill,
        paddingHorizontal: 16,
        paddingVertical: 8,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {IconCmp ? <IconCmp size={15} color={fg} strokeWidth={1.8} /> : null}
      <Text style={{ fontSize: 13, fontWeight: '600', color: fg }}>
        {label}
      </Text>
    </PressableStatic>
  );
}

// ── Group title: SectionTitle + "N chosen" on the right ──────────────────────
function GroupTitle({ title, count }: { title: string; count: number }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        marginTop: 18,
        marginBottom: 13,
      }}
    >
      <SectionTitle style={{ flex: 1, marginTop: 0, marginBottom: 0 }}>
        {title}
      </SectionTitle>
      {count > 0 ? (
        <Text style={{ fontSize: 13.5, color: EX.color.inkMuted }}>
          {chosenLabel(count)}
        </Text>
      ) : null}
    </View>
  );
}

// ── The sheet ────────────────────────────────────────────────────────────────
export function ExploreFilterSheet({
  filters,
  categories,
  onApply,
  onDismiss,
}: {
  /** The filters applied right now; the draft starts as a copy. */
  filters: ExploreFilters;
  /** "Visa type" options (Explore's chip list without "All"). */
  categories: string[];
  /** "Show visas": the parent sets `filters = draft` and unmounts the sheet. */
  onApply: (draft: ExploreFilters) => void;
  /** Any other close: the parent unmounts the sheet, filters unchanged. */
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  // Fixed height (spec): the sheet never jumps in size as rows filter.
  const cardH = screenH - insets.top - 12;

  // ── Draft (local; thrown away unless "Show visas") ─────────────────────────
  const [draft, setDraft] = useState<ExploreFilters>(() => ({
    categories: [...filters.categories],
    countries: [...filters.countries],
  }));
  const draftEmpty = filterCount(draft) === 0;

  // ── Countries (GET /countries, cached by Explore) ─────────────────────────
  const countriesQ = useCountriesWithVisas();
  const countriesState = queryState(countriesQ);
  // Chosen-first order fixed for this opening: the codes chosen at mount.
  const chosenAtOpen = useRef(filters.countries).current;
  const rows = useMemo(
    () => orderSheetCountries(countriesQ.data ?? [], chosenAtOpen),
    [countriesQ.data, chosenAtOpen],
  );
  const [countryQuery, setCountryQuery] = useState('');
  const shownRows = useMemo(
    () => searchSheetCountries(rows, countryQuery),
    [rows, countryQuery],
  );
  // No country has a visa (loaded fine): hide the whole Country group.
  const hideCountryGroup = countriesState === 'ready' && rows.length === 0;

  // ── Animation state ───────────────────────────────────────────────────────
  const [reduceMotion, setReduceMotion] = useState(false);
  // Card offset (0 = open, cardH = off-screen) and a 0..1 "openness" that
  // drives the backdrop (and the card itself under reduced motion).
  const translateY = useSharedValue(cardH);
  const backdrop = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const closing = useRef(false);

  // Open: slide + fade in, or a plain fade when reduce motion is on.
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (!alive) return;
        setReduceMotion(reduced);
        if (reduced) {
          translateY.value = 0;
          cardOpacity.value = 0;
          cardOpacity.value = withTiming(1, { duration: REDUCED_MS });
          backdrop.value = withTiming(1, { duration: REDUCED_MS });
        } else {
          translateY.value = withTiming(0, {
            duration: OPEN_SLIDE_MS,
            easing: CURVE,
          });
          backdrop.value = withTiming(1, {
            duration: OPEN_FADE_MS,
            easing: CURVE,
          });
        }
      });
    return () => {
      alive = false;
    };
    // Mount only: each opening is a fresh mount (shared values are stable).
  }, []);

  /**
   * Animate out, then tell the parent. `then` is `onApply(draft)` or
   * `onDismiss`. A ref guards against two closes (e.g. a backdrop tap during
   * a swipe). The parent is told on a JS timer matching the animation, which
   * keeps the callback (and the draft it closes over) on the JS thread.
   */
  const closeThen = (then: () => void) => {
    if (closing.current) return;
    closing.current = true;
    if (reduceMotion) {
      cardOpacity.value = withTiming(0, { duration: REDUCED_MS });
      backdrop.value = withTiming(0, { duration: REDUCED_MS });
    } else {
      translateY.value = withTiming(cardH, {
        duration: CLOSE_MS,
        easing: CURVE,
      });
      backdrop.value = withTiming(0, { duration: CLOSE_MS, easing: CURVE });
    }
    setTimeout(then, reduceMotion ? REDUCED_MS : CLOSE_MS);
  };
  const dismiss = () => closeThen(onDismiss);
  const apply = () => {
    const chosen = draft;
    closeThen(() => onApply(chosen));
  };

  // ── Drag to close ─────────────────────────────────────────────────────────
  // Callbacks run on the JS thread (`runOnJS(true)`): they call `dismiss`,
  // and the per-frame work is one shared-value write.
  const settleBack = () => {
    translateY.value = withTiming(0, { duration: CLOSE_MS, easing: CURVE });
    backdrop.value = withTiming(1, { duration: CLOSE_MS, easing: CURVE });
  };
  /** Follow the finger downward only (no upward stretch). */
  const follow = (dy: number) => {
    if (closing.current) return;
    const y = Math.max(0, dy);
    translateY.value = y;
    // Under reduced motion the card still follows the finger (drag works),
    // only the open / close animations are fades.
    backdrop.value = 1 - Math.min(1, y / cardH);
  };
  const release = (dy: number, vy: number) => {
    // A close already started (e.g. a backdrop tap mid-drag): let it finish.
    if (closing.current) return;
    if (dy > cardH * CLOSE_DISTANCE || vy > CLOSE_VELOCITY) {
      // Already moved: finish from where the finger left it.
      closing.current = true;
      translateY.value = withTiming(cardH, {
        duration: CLOSE_MS,
        easing: CURVE,
      });
      backdrop.value = withTiming(0, { duration: CLOSE_MS, easing: CURVE });
      setTimeout(onDismiss, CLOSE_MS);
    } else {
      settleBack();
    }
  };

  // Grab bar + title row: a plain downward pan.
  const headerPan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY(6)
    .onUpdate((e) => follow(e.translationY))
    .onEnd((e) => release(e.translationY, e.velocityY));

  // Body: only drags the card while the list is scrolled to the top. The
  // distance the finger travelled while the list was still scrolling is
  // subtracted (`bodyBase`), so the card starts moving from where the list
  // hit the top, not with a jump.
  const scrollY = useRef(0);
  const bodyBase = useRef<number | null>(null);
  const bodyScroll = Gesture.Native();
  const bodyPan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY(10)
    .failOffsetY(-10)
    .simultaneousWithExternalGesture(bodyScroll)
    .onStart(() => {
      bodyBase.current = null;
    })
    .onUpdate((e) => {
      if (scrollY.current > 0) {
        bodyBase.current = null;
        return;
      }
      if (bodyBase.current === null) bodyBase.current = e.translationY;
      follow(e.translationY - bodyBase.current);
    })
    .onEnd((e) => {
      if (bodyBase.current === null) return;
      release(e.translationY - bodyBase.current, e.velocityY);
      bodyBase.current = null;
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: cardOpacity.value,
  }));

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      // Android back: close and throw the draft away.
      onRequestClose={dismiss}
    >
      {/* RNGH needs its own root inside a Modal (Android). */}
      <GestureHandlerRootView style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* ── Backdrop: covers the whole screen, tab bar included ───────── */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: EXScrim.sheet,
            },
            backdropStyle,
          ]}
        >
          <PressableStatic
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel={C.closeFilters}
            style={{ flex: 1 }}
          />
        </Animated.View>

        {/* ── Card ─────────────────────────────────────────────────────── */}
        <Animated.View
          style={[
            {
              height: cardH,
              backgroundColor: EX.color.bg,
              borderTopLeftRadius: EX.radius.sheet,
              borderTopRightRadius: EX.radius.sheet,
            },
            EXShadow.sheet,
            cardStyle,
          ]}
        >
          <KeyboardAvoidingView
            // The footer rides above the keyboard while "Search countries"
            // is focused (as in the onboarding country step).
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            {/* Grab bar + title row: the drag handle. */}
            <GestureDetector gesture={headerPan}>
              <View>
                <View
                  style={{
                    alignSelf: 'center',
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: EX.color.line16,
                    marginTop: 10,
                  }}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 20,
                    paddingTop: 10,
                    paddingBottom: 6,
                  }}
                >
                  <Text
                    accessibilityRole="header"
                    style={[displayText(24, 'semibold'), { flex: 1 }]}
                  >
                    {C.filters}
                  </Text>
                  {/* Close circle: 40 + hit slop 2 = 44 pt. */}
                  <PressableStatic
                    onPress={dismiss}
                    hitSlop={2}
                    accessibilityRole="button"
                    accessibilityLabel={C.closeFilters}
                    style={({ pressed }) => ({
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: EX.color.line10,
                      backgroundColor: EX.color.cardWhite,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <Ic.x size={18} color={EX.color.ink} strokeWidth={1.8} />
                  </PressableStatic>
                </View>
              </View>
            </GestureDetector>

            {/* ── Scrolling body ───────────────────────────────────────── */}
            <GestureDetector gesture={bodyPan}>
              <View style={{ flex: 1 }}>
                <GestureDetector gesture={bodyScroll}>
                  <ScrollView
                    style={{ flex: 1 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    // No top bounce: at the top, a downward drag moves the
                    // card instead.
                    bounces={false}
                    scrollEventThrottle={16}
                    onScroll={(e) => {
                      scrollY.current = e.nativeEvent.contentOffset.y;
                    }}
                    contentContainerStyle={{
                      paddingHorizontal: 20,
                      paddingBottom: 24,
                    }}
                  >
                    {/* Visa type: one horizontal chip row, bleeding right. */}
                    <GroupTitle
                      title={C.visaType}
                      count={draft.categories.length}
                    />
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      style={{ marginRight: -20 }}
                      contentContainerStyle={{
                        gap: 8,
                        paddingRight: 20,
                        // Room for the chips' 6 pt hit slop.
                        paddingVertical: 6,
                      }}
                    >
                      {categories.map((c) => (
                        <ExploreFilterChip
                          key={c}
                          label={c}
                          selected={draft.categories.includes(c)}
                          onPress={() => setDraft((d) => toggleCategory(d, c))}
                        />
                      ))}
                    </ScrollView>

                    {/* Country: search + rows (hidden when none have visas). */}
                    {hideCountryGroup ? null : (
                      <>
                        <GroupTitle
                          title={C.country}
                          count={draft.countries.length}
                        />
                        <CountrySearch
                          value={countryQuery}
                          onChange={setCountryQuery}
                        />
                        <View style={{ gap: 8, marginTop: 8 }}>
                          {countriesState === 'loading' ? (
                            <StateLoading section />
                          ) : countriesState === 'error' ? (
                            <StateError
                              section
                              message={loadErrorCopy('countries')}
                              onRetry={() => countriesQ.refetch()}
                              retrying={countriesQ.isRefetching}
                            />
                          ) : shownRows.length === 0 ? (
                            <View
                              style={{
                                alignItems: 'center',
                                paddingVertical: 40,
                                gap: 10,
                              }}
                            >
                              <Ic.globe
                                size={34}
                                color={EX.color.muted}
                                strokeWidth={1.8}
                                style={{ opacity: 0.5 }}
                              />
                              <Text
                                style={{
                                  fontSize: 14,
                                  color: EX.color.inkMuted,
                                  textAlign: 'center',
                                }}
                              >
                                {C.noCountries(countryQuery.trim())}
                              </Text>
                            </View>
                          ) : (
                            shownRows.map((r) => (
                              <CountryRow
                                key={r.code}
                                code={r.code}
                                name={r.name}
                                visas={r.visaTypesCount}
                                selected={draft.countries.includes(r.code)}
                                onPress={() =>
                                  setDraft((d) => toggleCountry(d, r.code))
                                }
                              />
                            ))
                          )}
                        </View>
                      </>
                    )}
                  </ScrollView>
                </GestureDetector>
              </View>
            </GestureDetector>

            {/* ── Footer (fixed): Clear all · Show visas ────────────────── */}
            <BlurView
              intensity={30}
              tint="light"
              style={{
                backgroundColor: EX.color.glassWarmSoft,
                borderTopWidth: 1,
                borderTopColor: EX.color.line06,
                paddingTop: 15,
                paddingHorizontal: 20,
                paddingBottom: Math.max(insets.bottom, 16) + 6,
                flexDirection: 'row',
                gap: 10,
              }}
            >
              {/* Outline "Clear all": empties the draft only. */}
              <PressableStatic
                onPress={() => setDraft(clearFilters())}
                disabled={draftEmpty}
                accessibilityRole="button"
                accessibilityLabel={C.clearAll}
                accessibilityState={{ disabled: draftEmpty }}
                style={({ pressed }) => ({
                  height: 54,
                  borderRadius: EX.radius.button,
                  paddingHorizontal: 20,
                  backgroundColor: EX.color.cardWhite,
                  borderWidth: 1,
                  borderColor: EX.color.line10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: draftEmpty ? 0.6 : pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    fontSize: 15.5,
                    fontWeight: '700',
                    color: EX.color.ink,
                  }}
                >
                  {C.clearAll}
                </Text>
              </PressableStatic>
              {/* Coral "Show visas": always enabled; an empty draft removes
                  every filter. No count (orchestrator decision 2). */}
              <PressableStatic
                onPress={apply}
                accessibilityRole="button"
                accessibilityLabel={C.showVisas}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    height: 54,
                    borderRadius: EX.radius.button,
                    backgroundColor: EX.color.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1,
                  },
                  EXShadow.primaryBtn,
                ]}
              >
                <Text
                  style={{ fontSize: 15.5, fontWeight: '700', color: '#fff' }}
                >
                  {C.showVisas}
                </Text>
              </PressableStatic>
            </BlurView>
          </KeyboardAvoidingView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ── Country search pill (as CountryPickerList: 48 tall, surface, line-10) ────
function CountrySearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        height: 48,
        borderRadius: EX.radius.pill,
        paddingHorizontal: 16,
        backgroundColor: EX.color.cardWhite,
        borderWidth: 1,
        borderColor: EX.color.line10,
      }}
    >
      <Ic.search size={18} color={EX.color.muted} strokeWidth={1.8} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={C.searchCountries}
        placeholderTextColor={EX.color.muted}
        autoCorrect={false}
        accessibilityLabel={C.searchCountries}
        style={{
          flex: 1,
          fontSize: 15,
          color: EX.color.ink,
          paddingVertical: 0,
        }}
      />
    </View>
  );
}

// ── Country row ──────────────────────────────────────────────────────────────
// Copied from CountryPickerList's row (HoldingsParts.tsx), not shared: that
// list loads its own countries (`useCountries(true)`) and carries onboarding /
// picker states (disabled, busy, capped) this sheet has no use for. Same look:
// Flag 28, name, coral check, OptionCard-style coral selection, plus the
// "N visas" sub-line the spec adds. Height ≥ 52 pt.
function CountryRow({
  code,
  name,
  visas,
  selected,
  onPress,
}: {
  code: string;
  name: string;
  visas: number;
  selected: boolean;
  onPress: () => void;
}) {
  const sub = visaCountLabel(visas);
  return (
    <PressableStatic
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${sub}`}
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        minHeight: 52,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? EX.color.primary : EX.color.line08,
        backgroundColor: selected ? EX.color.primaryTint07 : EX.color.cardWhite,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Flag code={code.toLowerCase()} size={28} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 15, fontWeight: '600', color: EX.color.ink }}
        >
          {name}
        </Text>
        <Text style={{ fontSize: 13, color: EX.color.inkMuted }}>{sub}</Text>
      </View>
      {selected ? (
        <Ic.check size={20} color={EX.color.primary} strokeWidth={2.6} />
      ) : null}
    </PressableStatic>
  );
}
