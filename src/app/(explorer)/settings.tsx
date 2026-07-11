// ─────────────────────────────────────────────────────────────────────────────
// Settings screen (Explorer, coral/cream design).
// Grouped white cards that reuse the profile.tsx `ProfileRow` visual language:
//   36px cream icon chip · label 15/600 · optional muted value · chevron.
// Sections: Appearance · Notifications · Billing · Legal · Support · Account.
// All interactions are display-only mocks (the Explorer prototype is light-only).
// Native primitives only; safe-area aware.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
// Subscription tier label is derived from the shared demo plan catalogue.
import { PLANS, CURRENT_PLAN } from '@/components/explorer/data';

// ── One settings row ─────────────────────────────────────────────────────────
// Mirrors profile.tsx `ProfileRow`: 36px cream icon chip, 15/600 label, optional
// muted value on the right, then a chevron. `right` lets a caller swap the value
// slot for a custom control (e.g. a Switch); `danger` tints the label + icon.
function SettingsRow({
  icon: IconCmp,
  label,
  value,
  right,
  divider = false,
  danger = false,
  onPress,
}: {
  icon: React.ElementType;
  label: string;
  value?: string;
  right?: React.ReactNode;
  divider?: boolean;
  danger?: boolean;
  onPress?: () => void;
}) {
  // Coral-danger tint reuses the same colour profile.tsx uses for "Sign out".
  const labelColor = danger ? EX.color.danger : EX.color.ink;
  const iconColor = danger ? EX.color.danger : EX.color.primary;

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
      {/* 36px cream icon chip (identical to profile.tsx) */}
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
        <IconCmp size={19} color={iconColor} strokeWidth={1.8} />
      </View>

      <Text
        style={{ flex: 1, fontSize: 15, fontWeight: '600', color: labelColor }}
      >
        {label}
      </Text>

      {/* Right slot: a custom control (Switch) wins; else a muted value string. */}
      {right ? (
        right
      ) : value ? (
        <Text
          style={{ fontSize: 13.5, color: EX.color.muted, fontWeight: '500' }}
        >
          {value}
        </Text>
      ) : null}

      {/* Chevron only when this row navigates / has an action AND no custom control. */}
      {!right ? (
        <Ic.chevR size={18} color="rgba(23,19,38,0.32)" strokeWidth={1.8} />
      ) : null}
    </Pressable>
  );
}

// ── Group label (muted 12.5/700 uppercase, letter-spaced) ─────────────────────
function GroupLabel({ children }: { children: string }) {
  return (
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
      {children}
    </Text>
  );
}

// ── Grouped white card wrapper (matches profile.tsx menu groups) ──────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Local (display-only) preference state ──────────────────────────────────
  // The Explorer prototype renders light-only; theme selection is stored but not
  // applied. Notification toggles default on.
  const [theme, setTheme] = useState<'System' | 'Light' | 'Dark'>('System');
  const [pushOn, setPushOn] = useState(true);
  const [emailOn, setEmailOn] = useState(true);

  // Subscription tier label from the shared plan catalogue.
  const currentPlanName =
    PLANS.find((p) => p.id === CURRENT_PLAN)?.name ?? 'Free';

  // Coral track when a Switch is on; neutral hairline track when off.
  const switchTrack = { false: EX.color.line10, true: EX.color.primary };

  // ── Theme action sheet ─────────────────────────────────────────────────────
  const openThemeSheet = () => {
    Alert.alert('Theme', 'Choose how Seli looks', [
      { text: 'System', onPress: () => setTheme('System') },
      { text: 'Light', onPress: () => setTheme('Light') },
      { text: 'Dark', onPress: () => setTheme('Dark') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Open an external URL, swallowing failures (placeholder links) ───────────
  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      // Placeholder URLs may not resolve in the demo — fail silently.
    }
  };

  // ── Sign out (mock): confirm, then bounce back to home ─────────────────────
  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => router.replace('/(explorer)/(auth)/welcome'),
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* ── Back header (matches consultations.tsx detail pattern) ──────────── */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 18,
          paddingBottom: 6,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
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
          <Text style={displayText(24, 'semibold')}>Settings</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: EX.space.screenX,
          paddingTop: 16,
          paddingBottom: 40,
        }}
      >
        {/* ── 1. Appearance ──────────────────────────────────────────────── */}
        <GroupLabel>Appearance</GroupLabel>
        <Card>
          <SettingsRow
            icon={Ic.crown}
            label="Theme"
            value={theme}
            onPress={openThemeSheet}
          />
        </Card>

        {/* ── 2. Notifications ───────────────────────────────────────────── */}
        <View style={{ height: 22 }} />
        <GroupLabel>Notifications</GroupLabel>
        <Card>
          <SettingsRow
            icon={Ic.bell}
            label="Push notifications"
            right={
              <Switch
                value={pushOn}
                onValueChange={setPushOn}
                trackColor={switchTrack}
                thumbColor="#fff"
                ios_backgroundColor={EX.color.line10}
              />
            }
          />
          <SettingsRow
            icon={Ic.msg}
            label="Email updates"
            divider
            right={
              <Switch
                value={emailOn}
                onValueChange={setEmailOn}
                trackColor={switchTrack}
                thumbColor="#fff"
                ios_backgroundColor={EX.color.line10}
              />
            }
          />
        </Card>

        {/* ── 3. Billing ─────────────────────────────────────────────────── */}
        <View style={{ height: 22 }} />
        <GroupLabel>Billing</GroupLabel>
        <Card>
          <SettingsRow
            icon={Ic.cards}
            label="Subscription"
            value={currentPlanName}
            onPress={() => router.push('/(explorer)/subscription')}
          />
        </Card>

        {/* ── 4. Legal ───────────────────────────────────────────────────── */}
        <View style={{ height: 22 }} />
        <GroupLabel>Legal</GroupLabel>
        <Card>
          <SettingsRow
            icon={Ic.shield}
            label="Privacy Policy"
            onPress={() => openUrl('https://weareseli.com/privacy')}
          />
          <SettingsRow
            icon={Ic.docs}
            label="Terms of Service"
            divider
            onPress={() => openUrl('https://weareseli.com/terms')}
          />
        </Card>

        {/* ── 5. Support ─────────────────────────────────────────────────── */}
        <View style={{ height: 22 }} />
        <GroupLabel>Support</GroupLabel>
        <Card>
          <SettingsRow
            icon={Ic.help}
            label="Help Center"
            onPress={() => openUrl('https://weareseli.com/help')}
          />
          <SettingsRow
            icon={Ic.msg}
            label="Contact support"
            divider
            onPress={() => openUrl('mailto:support@weareseli.com')}
          />
        </Card>

        {/* ── 6. Account ─────────────────────────────────────────────────── */}
        <View style={{ height: 22 }} />
        <GroupLabel>Account</GroupLabel>
        <Card>
          <SettingsRow
            icon={Ic.shield}
            label="Sign out"
            danger
            onPress={confirmSignOut}
          />
        </Card>

        {/* ── 7. Footer ──────────────────────────────────────────────────── */}
        <View style={{ alignItems: 'center', marginTop: 34, gap: 3 }}>
          <Text
            style={[displayText(16, 'semibold'), { color: EX.color.muted }]}
          >
            Seli
          </Text>
          <Text
            style={{ fontSize: 12.5, color: EX.color.muted, fontWeight: '500' }}
          >
            Version 1.0.0
          </Text>
          <Text
            style={{ fontSize: 12.5, color: EX.color.muted, fontWeight: '500' }}
          >
            Made with care by Durin Technologies
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
