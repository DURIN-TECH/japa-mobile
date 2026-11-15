// ─────────────────────────────────────────────────────────────────────────────
// Developer configuration screen (japa#330).
//
// Shows the configuration the RUNNING app is actually using — environment,
// API server, Firebase project, emulator flag, build / update info, the
// signed-in user's role claim and token expiry, device. Rows flagged `warn`
// (native Firebase project ≠ configured project, expired token) are tinted.
//
// Opened from the Expo dev menu ("App configuration", src/utils/dev-menu.ts);
// there is no in-app entry point. Development builds only (`__DEV__`): in any
// release build — TestFlight (`tester`, APP_ENV=staging) included — a link
// to /dev-config renders nothing and sends the user back. It used to gate on
// IS_PROD, which let a TestFlight build open it (fixed in japa#375 review).
// "Share" hands the whole block to the OS share sheet (Copy is one of its
// options), so it can be pasted into a bug report — no native clipboard
// module needed.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { isDevBuild } from '@/config/isDevBuild';
import {
  buildDevConfigSections,
  devConfigToText,
  type DevConfigSection,
} from '@/config/devConfigInfo';
import { collectDevConfigSources } from '@/config/devConfigCollect';

export default function DevConfigScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sections, setSections] = useState<DevConfigSection[] | null>(null);

  // Read the live values; also used by "Refresh" (e.g. after signing in again).
  const load = useCallback(async () => {
    setSections(null);
    const sources = await collectDevConfigSources();
    setSections(buildDevConfigSections(sources));
  }, []);

  useEffect(() => {
    // Release-build guard: a deep link to /dev-config outside a development
    // build goes straight back.
    if (!isDevBuild()) {
      router.back();
      return;
    }
    load();
  }, [load, router]);

  if (!isDevBuild()) return null;

  const share = () => {
    if (!sections) return;
    Share.share({ message: devConfigToText(sections) }).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* ── Back header (same pattern as settings.tsx) ───────────────────── */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 18,
          paddingBottom: 6,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
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
        <Text style={[displayText(24, 'semibold'), { flex: 1 }]}>
          App configuration
        </Text>
        <Pressable onPress={load} hitSlop={8} accessibilityLabel="Refresh">
          <Text style={{ color: EX.color.primary, fontWeight: '600' }}>
            Refresh
          </Text>
        </Pressable>
      </View>

      {!sections ? (
        // Loading = coral spinner (design-system rule).
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator color={EX.color.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: EX.space.screenX,
            paddingTop: 12,
            paddingBottom: insets.bottom + 40,
          }}
        >
          {sections.map((sec) => (
            <View key={sec.title} style={{ marginBottom: 22 }}>
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: '700',
                  color: EX.color.muted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginBottom: 10,
                  marginLeft: 4,
                }}
              >
                {sec.title}
              </Text>
              <View
                style={{
                  backgroundColor: '#fff',
                  borderWidth: 1,
                  borderColor: EX.color.line06,
                  borderRadius: 22,
                  overflow: 'hidden',
                }}
              >
                {sec.rows.map((row, i) => (
                  <View
                    key={row.label}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: EX.color.line06,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12.5,
                        color: EX.color.muted,
                        fontWeight: '600',
                      }}
                    >
                      {row.label}
                    </Text>
                    {/* Values are selectable so a single one can be copied. */}
                    <Text
                      selectable
                      style={{
                        fontSize: 14.5,
                        marginTop: 2,
                        fontWeight: '600',
                        color: row.warn ? EX.color.danger : EX.color.ink,
                      }}
                    >
                      {row.warn ? `⚠ ${row.value}` : row.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          {/* ── Share the whole block (OS sheet includes Copy) ─────────────── */}
          <Pressable
            onPress={share}
            accessibilityRole="button"
            style={{
              backgroundColor: EX.color.primary,
              borderRadius: 999,
              paddingVertical: 15,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
              Share or copy all
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}
