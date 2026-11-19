// ─────────────────────────────────────────────────────────────────────────────
// The three real-data sections of /visa/[id] (japa#255): "Cost & timeline",
// "Eligibility" and "Official source". They reuse the card pattern of the
// "What you'll need" card (white, radius-card, 1px line08, shadow-card, rows
// divided by line06). Each section owns its 26 top margin and renders null when
// it has nothing to show, so a hidden section leaves no gap.
//
// Data decisions live in visaBreakdownLogic.ts; this file is presentation only.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Linking, Text, View } from 'react-native';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import type { VisaType } from '@/types/visas.type';
import {
  costTimelineRows,
  eligibilityItems,
  officialSource,
  type BreakdownIcon,
} from '@/components/explorer/visaBreakdownLogic';

// Logic icon key → design-system icon.
const ICON: Record<BreakdownIcon, typeof Ic.cards> = {
  cards: Ic.cards,
  clock: Ic.clock,
  cal: Ic.cal,
  layers: Ic.layers,
};

// Section title (18/700 ink, 26 above, 12 below) — same as "What you'll need".
function SectionTitle({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: 18,
        fontWeight: '700',
        color: EX.color.ink,
        letterSpacing: -0.18,
        marginTop: 26,
        marginBottom: 12,
        marginHorizontal: 2,
      }}
    >
      {children}
    </Text>
  );
}

// White card shell shared by the three sections.
function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: EX.color.cardWhite,
        borderWidth: 1,
        borderColor: EX.color.line08,
        borderRadius: EX.radius.card,
        overflow: 'hidden',
        shadowColor: '#171326',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      {children}
    </View>
  );
}

// 30px cream tile (radius 9) holding a coral icon.
function Tile({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: EX.color.cream,
      }}
    >
      {children}
    </View>
  );
}

/** "Cost & timeline": label over value rows; hidden when no row has a value. */
export function CostTimelineSection({
  visa,
  statStripProcessing,
}: {
  visa: VisaType;
  /** What the stat strip already shows for Processing (row skipped if equal). */
  statStripProcessing?: string;
}) {
  const rows = costTimelineRows(visa, statStripProcessing);
  if (rows.length === 0) return null;
  return (
    <>
      <SectionTitle>Cost &amp; timeline</SectionTitle>
      <Card>
        {rows.map((r, i) => {
          const Icon = ICON[r.icon];
          return (
            <View
              key={r.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 13,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: EX.color.line06,
              }}
            >
              <Tile>
                <Icon size={15} color={EX.color.primary} strokeWidth={1.8} />
              </Tile>
              {/* Stacked so long values wrap instead of truncating. */}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '600',
                    color: EX.color.inkMuted,
                  }}
                >
                  {r.label}
                </Text>
                <Text
                  style={{
                    fontSize: 14.5,
                    fontWeight: '600',
                    color: EX.color.ink,
                    marginTop: 1,
                  }}
                >
                  {r.value}
                </Text>
                {r.hint ? (
                  <Text
                    style={{
                      fontSize: 12.5,
                      color: EX.color.inkMuted,
                      marginTop: 2,
                    }}
                  >
                    {r.hint}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </Card>
    </>
  );
}

/** "Eligibility": one row per non-blank criterion (not numbered). */
export function EligibilitySection({ visa }: { visa: VisaType }) {
  const items = eligibilityItems(visa);
  if (items.length === 0) return null;
  return (
    <>
      <SectionTitle>Eligibility</SectionTitle>
      <Card>
        {items.map((t, i) => (
          <View
            key={`${t}-${i}`}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderTopWidth: i ? 1 : 0,
              borderTopColor: EX.color.line06,
            }}
          >
            {/* Coral check, not teal (teal means verified). */}
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: EX.color.cream,
                marginTop: 0,
              }}
            >
              <Ic.check size={12} color={EX.color.primary} strokeWidth={1.8} />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 14.5,
                lineHeight: 22,
                color: EX.color.ink2,
              }}
            >
              {t}
            </Text>
          </View>
        ))}
      </Card>
    </>
  );
}

/** "Official source": one pressable row opening `applicationUrl`. */
export function OfficialSourceSection({ visa }: { visa: VisaType }) {
  const source = officialSource(visa);
  if (!source) return null;

  // Swallow a failure to open, as settings.tsx does for external links.
  const open = async () => {
    try {
      await Linking.openURL(source.url);
    } catch {
      // Nothing useful to show; the row simply does nothing.
    }
  };

  return (
    <>
      <SectionTitle>Official source</SectionTitle>
      <Card>
        <PressableStatic
          onPress={open}
          accessibilityRole="link"
          accessibilityLabel="Official application page"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 13,
            minHeight: 56,
            paddingVertical: 14,
            paddingHorizontal: 16,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Tile>
            <Ic.globe size={15} color={EX.color.primary} strokeWidth={1.8} />
          </Tile>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{ fontSize: 14.5, fontWeight: '600', color: EX.color.ink }}
            >
              Official application page
            </Text>
            {source.instructions ? (
              <Text
                style={{
                  fontSize: 12.5,
                  lineHeight: 18,
                  color: EX.color.inkMuted,
                  marginTop: 2,
                }}
              >
                {source.instructions}
              </Text>
            ) : null}
          </View>
          <Ic.arrowUR size={17} color={EX.color.primary} strokeWidth={1.8} />
        </PressableStatic>
      </Card>
    </>
  );
}
