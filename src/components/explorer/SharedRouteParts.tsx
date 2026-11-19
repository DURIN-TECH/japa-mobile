// ─────────────────────────────────────────────────────────────────────────────
// Building blocks for shared routes (japa#237, P8a of #228).
//
//   LayerPill        neutral cream pill: "Shared rules" / "Rules for {country}"
//   AlsoCoversCard   visa screen: "Also covers other countries" + country chips
//   AlsoCoversPill   a row's pill: "Also covers {n} other countries"
//   ThroughRow       application screen: "Through {country}" chip, route pill,
//                    "Change country" link (only when the backend allows it)
//   SourceLink       coral-dark "Source" link that opens the official page
//
// A layer is not a status, so the pill is neutral (no status colour, no coral
// fill). Pressables use PressableStatic. NO country names live here: they all
// arrive as props from API data.
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { Card, Flag, IconChip } from '@/components/explorer/primitives';
import {
  SHARED_COPY,
  alsoCoversPillLabel,
  alsoCoversSub,
  hasMoreCovers,
  layerLabel,
  otherCovers,
  visibleCovers,
  type LayerLabel,
} from '@/components/explorer/sharedRouteLogic';
import type { PublicSharedRoute, StackLayer } from '@/types/sharedRoute.type';

// ── LayerPill ────────────────────────────────────────────────────────────────
/** Neutral pill for one layer label (null label renders nothing). */
export function LayerPill({ label }: { label: LayerLabel | null }) {
  if (!label) return null;
  const IconCmp = label.kind === 'shared' ? Ic.users : Ic.pin;
  return (
    <View
      accessible
      accessibilityLabel={label.a11y}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        maxWidth: 220,
        backgroundColor: EX.color.cream,
        borderWidth: 1,
        borderColor: EX.color.line08,
        borderRadius: EX.radius.pill,
        paddingVertical: 4,
        paddingHorizontal: 10,
      }}
    >
      <IconCmp size={12} color={EX.color.primary} strokeWidth={2} />
      <Text
        numberOfLines={1}
        style={{
          flexShrink: 1,
          fontSize: 12,
          fontWeight: '700',
          color: EX.color.ink2,
        }}
      >
        {label.text}
      </Text>
    </View>
  );
}

// ── Stack layers, shared down a screen ───────────────────────────────────────
// A screen that has the stack's layer list puts it in this context; rows and
// cards deep inside ask for their own pill with `useLayerPill(layerKey)`, so the
// layer list does not have to be threaded through every component.
const StackLayersContext = createContext<StackLayer[] | undefined>(undefined);

export function StackLayersProvider({
  layers,
  children,
}: {
  layers: StackLayer[] | undefined;
  children: React.ReactNode;
}) {
  return (
    <StackLayersContext.Provider value={layers}>
      {children}
    </StackLayersContext.Provider>
  );
}

/** The pill label for an item's layerKey (null on a one-layer rulebook). */
export function useLayerLabel(layerKey?: string | null): LayerLabel | null {
  const layers = useContext(StackLayersContext);
  return layerLabel(layers, layerKey);
}

/** A pill for an item's layerKey, read from the surrounding StackLayersProvider. */
export function LayerPillFor({ layerKey }: { layerKey?: string | null }) {
  return <LayerPill label={useLayerLabel(layerKey)} />;
}

// ── AlsoCoversCard (visa screen) ─────────────────────────────────────────────
/** One country chip: flag + name on one line (ellipsis at 180). Not tappable. */
function CountryChip({ code, name }: { code: string; name: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        maxWidth: 180,
        backgroundColor: EX.color.cream,
        borderWidth: 1,
        borderColor: EX.color.line12,
        borderRadius: EX.radius.pill,
        paddingVertical: 6,
        paddingHorizontal: 10,
      }}
    >
      <Flag code={code.toLowerCase()} size={20} radius={5} />
      <Text
        numberOfLines={1}
        style={{
          flexShrink: 1,
          fontSize: 12.5,
          fontWeight: '600',
          color: EX.color.ink,
        }}
      >
        {name}
      </Text>
    </View>
  );
}

/**
 * "Also covers other countries". Renders nothing unless the route covers at
 * least one country other than `countryCode` (the visa on screen).
 */
export function AlsoCoversCard({
  route,
  countryCode,
}: {
  route: PublicSharedRoute | null | undefined;
  countryCode: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!route) return null;
  const others = otherCovers(route, countryCode);
  if (others.length === 0) return null;
  const shown = visibleCovers(others, expanded);
  return (
    <Card style={{ marginTop: 26 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconChip icon={Ic.globe} size={38} radius={12} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{ fontSize: 15, fontWeight: '600', color: EX.color.ink }}
          >
            {SHARED_COPY.alsoCoversTitle}
          </Text>
          <Text
            style={{
              fontSize: 13.5,
              lineHeight: 19,
              color: EX.color.inkMuted,
              marginTop: 1,
            }}
          >
            {alsoCoversSub(route)}
          </Text>
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 12,
        }}
      >
        {shown.map((c) => (
          <CountryChip
            key={c.countryCode}
            code={c.countryCode}
            name={c.countryName}
          />
        ))}
      </View>
      {hasMoreCovers(others) ? (
        <PressableStatic
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          style={{
            minHeight: 44,
            justifyContent: 'center',
            alignSelf: 'flex-start',
          }}
        >
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: '600',
              color: EX.color.primaryDark,
            }}
          >
            {expanded
              ? SHARED_COPY.showFewer
              : SHARED_COPY.showAll(others.length)}
          </Text>
        </PressableStatic>
      ) : null}
    </Card>
  );
}

// ── AlsoCoversPill (a visa row) ──────────────────────────────────────────────
/** "Also covers {n} other countries" in the neutral pill style; null when none. */
export function AlsoCoversPill({
  route,
}: {
  route: PublicSharedRoute | null | undefined;
}) {
  const text = alsoCoversPillLabel(route);
  if (!text) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        backgroundColor: EX.color.cream,
        borderWidth: 1,
        borderColor: EX.color.line08,
        borderRadius: EX.radius.pill,
        paddingVertical: 4,
        paddingHorizontal: 10,
        marginTop: 4,
      }}
    >
      <Ic.users size={12} color={EX.color.primary} strokeWidth={2} />
      <Text style={{ fontSize: 12, fontWeight: '700', color: EX.color.ink2 }}>
        {text}
      </Text>
    </View>
  );
}

// ── ThroughRow (application screen) ──────────────────────────────────────────
/**
 * "Through {country}" chip, the route-name pill, and (only when allowed)
 * "Change country". The caller decides visibility with sharedRouteLogic.
 */
export function ThroughRow({
  countryCode,
  countryName,
  routeName,
  showRoutePill,
  canChange,
  onChange,
}: {
  countryCode?: string;
  countryName: string;
  routeName?: string;
  showRoutePill: boolean;
  canChange: boolean;
  onChange: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          backgroundColor: EX.color.cream,
          borderWidth: 1,
          borderColor: EX.color.line12,
          borderRadius: EX.radius.pill,
          paddingVertical: 6,
          paddingHorizontal: 10,
          maxWidth: 260,
        }}
      >
        {countryCode ? (
          <Flag code={countryCode.toLowerCase()} size={20} radius={5} />
        ) : null}
        <Text
          numberOfLines={1}
          style={{
            flexShrink: 1,
            fontSize: 12.5,
            fontWeight: '600',
            color: EX.color.ink,
          }}
        >
          {`Through ${countryName}`}
        </Text>
      </View>
      {showRoutePill && routeName ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            maxWidth: 240,
            backgroundColor: EX.color.cream,
            borderWidth: 1,
            borderColor: EX.color.line08,
            borderRadius: EX.radius.pill,
            paddingVertical: 4,
            paddingHorizontal: 10,
          }}
        >
          <Ic.users size={12} color={EX.color.primary} strokeWidth={2} />
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontSize: 12,
              fontWeight: '700',
              color: EX.color.ink2,
            }}
          >
            {routeName}
          </Text>
        </View>
      ) : null}
      {canChange ? (
        <PressableStatic
          onPress={onChange}
          accessibilityRole="button"
          accessibilityLabel={SHARED_COPY.changeCountry}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: '600',
              color: EX.color.primaryDark,
            }}
          >
            {SHARED_COPY.changeCountry}
          </Text>
        </PressableStatic>
      ) : null}
    </View>
  );
}

// ── SourceLink ───────────────────────────────────────────────────────────────
/** "Source" in coral-dark with an external-link glyph; 44px touch height. */
export function SourceLink({ url }: { url: string }) {
  if (!url) return null;
  return (
    <PressableStatic
      onPress={() => {
        Linking.openURL(url).catch(() => undefined);
      }}
      accessibilityRole="link"
      accessibilityLabel="Source, opens in browser"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        minHeight: 44,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontSize: 12.5,
          fontWeight: '600',
          color: EX.color.primaryDark,
        }}
      >
        {SHARED_COPY.source}
      </Text>
      <Ic.arrowUR size={14} color={EX.color.primaryDark} strokeWidth={2} />
    </PressableStatic>
  );
}
