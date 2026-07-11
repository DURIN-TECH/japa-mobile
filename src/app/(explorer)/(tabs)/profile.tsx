// ─────────────────────────────────────────────────────────────────────────────
// Profile tab (prototype profile.jsx ProfileView).
// Tonal purple header + floating glass stats + premium upsell + two menu groups
// + sign out. Ported 1:1 from source (paddings, radii, colors preserved).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { Portrait, Verified } from '@/components/explorer/primitives';
// Real Firebase sign-out — clears auth state, then returns to the auth entry.
import { authService } from '@/services/auth.service';

// ── One settings/menu row ────────────────────────────────────────────────────
function ProfileRow({
  icon: IconCmp,
  label,
  value,
  divider = false,
  onPress,
}: {
  icon: React.ElementType;
  label: string;
  value?: string;
  divider?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 15,
        paddingHorizontal: 16,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: EX.color.line06,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: EX.color.cream,
        }}
      >
        <IconCmp size={19} color={EX.color.primary} strokeWidth={1.8} />
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: '600',
          color: EX.color.ink,
        }}
      >
        {label}
      </Text>
      {value ? (
        <Text
          style={{ fontSize: 13.5, color: EX.color.muted, fontWeight: '500' }}
        >
          {value}
        </Text>
      ) : null}
      <Ic.chevR size={18} color="rgba(23,19,38,0.32)" strokeWidth={1.8} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Real sign-out: clear Firebase auth, then return to the auth entry ───────
  const onSignOut = async () => {
    try {
      await authService.logout();
    } finally {
      router.replace('/(explorer)/(auth)/welcome');
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: EX.color.bg }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: EX.space.tabClear }}
    >
      {/* Tonal header */}
      <LinearGradient
        colors={[EX.color.profileTop, EX.color.profileBot]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{
          paddingTop: insets.top + 30,
          paddingHorizontal: 22,
          paddingBottom: 44,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: -50,
            right: -30,
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: 'rgba(255,255,255,0.05)',
          }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Portrait
            seed={3}
            size={70}
            name="Alex K"
            style={{ borderWidth: 3, borderColor: 'rgba(255,255,255,0.18)' }}
          />
          <View>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}
            >
              <Text style={[displayText(23, 'semibold'), { color: '#fff' }]}>
                Alex Kayode
              </Text>
              <Verified size={17} />
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginTop: 4,
              }}
            >
              <Ic.pin
                size={14}
                color="rgba(255,255,255,0.8)"
                strokeWidth={1.8}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: 'rgba(255,255,255,0.8)',
                }}
              >
                Lagos, Nigeria
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Floating glass stats */}
      <View style={{ paddingHorizontal: 22, marginTop: -28, zIndex: 5 }}>
        <BlurView
          intensity={24}
          tint="light"
          style={{
            flexDirection: 'row',
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.74)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.6)',
          }}
        >
          {[
            ['3', 'Active'],
            ['7', 'Saved'],
            ['2', 'Agents'],
          ].map(([v, l], i) => (
            <React.Fragment key={l}>
              {i > 0 ? (
                <View style={{ width: 1, backgroundColor: EX.color.line10 }} />
              ) : null}
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 15,
                  paddingHorizontal: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: EX.color.ink,
                  }}
                >
                  {v}
                </Text>
                <Text
                  style={{
                    fontSize: 11.5,
                    color: EX.color.inkMuted,
                    fontWeight: '500',
                    marginTop: 2,
                  }}
                >
                  {l}
                </Text>
              </View>
            </React.Fragment>
          ))}
        </BlurView>
      </View>

      <View style={{ paddingHorizontal: 22, paddingTop: 22 }}>
        {/* Premium upsell */}
        <Pressable onPress={() => router.push('/(explorer)/subscription')}>
          <LinearGradient
            colors={[EX.color.primary, EX.color.primaryDark]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{
              borderRadius: 22,
              padding: 18,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              overflow: 'hidden',
              shadowColor: EX.color.primary,
              shadowOpacity: 0.45,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 12 },
              elevation: 6,
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: -30,
                right: -20,
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: 'rgba(255,255,255,0.12)',
              }}
            />
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 13,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ic.crown size={23} color="#fff" strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ fontSize: 15.5, fontWeight: '700', color: '#fff' }}
              >
                Upgrade to Seli Plus
              </Text>
              <Text
                style={{
                  fontSize: 12.5,
                  color: 'rgba(255,255,255,0.85)',
                  marginTop: 1,
                }}
              >
                Agent chat, uploads &amp; priority support
              </Text>
            </View>
            <Ic.chevR size={20} color="#fff" strokeWidth={1.8} />
          </LinearGradient>
        </Pressable>

        {/* Menu group 1 */}
        <View
          style={{
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: EX.color.line06,
            borderRadius: 22,
            overflow: 'hidden',
            shadowColor: '#171326',
            shadowOpacity: 0.04,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }}
        >
          <ProfileRow
            icon={Ic.cal}
            label="My consultations"
            value="2 upcoming"
            onPress={() => router.push('/(explorer)/consultations')}
          />
          <ProfileRow
            icon={Ic.msg}
            label="Messages"
            value="2 new"
            divider
            onPress={() => router.push('/(explorer)/messages')}
          />
          <ProfileRow
            icon={Ic.docs}
            label="My documents"
            value="7 files"
            divider
            onPress={() => router.push('/(explorer)/documents')}
          />
          <ProfileRow
            icon={Ic.cards}
            label="Payments"
            value="₦110,000"
            divider
            onPress={() => router.push('/(explorer)/payments')}
          />
          <ProfileRow
            icon={Ic.heart}
            label="Saved destinations"
            value="7"
            divider
            onPress={() => router.push('/(explorer)/saved')}
          />
        </View>

        {/* Menu group 2 */}
        <View
          style={{
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: EX.color.line06,
            borderRadius: 22,
            overflow: 'hidden',
            marginTop: 14,
            shadowColor: '#171326',
            shadowOpacity: 0.04,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }}
        >
          <ProfileRow
            icon={Ic.sliders}
            label="Settings"
            onPress={() => router.push('/(explorer)/settings')}
          />
          <ProfileRow
            icon={Ic.crown}
            label="Subscription"
            value="Free"
            divider
            onPress={() => router.push('/(explorer)/subscription')}
          />
          <ProfileRow
            icon={Ic.bell}
            label="Notifications"
            divider
            onPress={() => router.push('/(explorer)/notifications')}
          />
          <ProfileRow
            icon={Ic.shield}
            label="Privacy & security"
            divider
            onPress={() => router.push('/(explorer)/settings')}
          />
          <ProfileRow
            icon={Ic.msg}
            label="Help & support"
            divider
            onPress={() => router.push('/(explorer)/settings')}
          />
        </View>

        {/* Sign out — real Firebase logout, then back to the auth entry */}
        <Pressable
          onPress={onSignOut}
          style={{
            marginTop: 14,
            height: 52,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: EX.color.line10,
            backgroundColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{ fontSize: 15, fontWeight: '700', color: EX.color.danger }}
          >
            Sign out
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
