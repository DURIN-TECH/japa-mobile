// ─────────────────────────────────────────────────────────────────────────────
// Settings screen (Explorer, coral/cream design).
// Grouped white cards that reuse the profile.tsx `ProfileRow` visual language:
//   36px cream icon chip · label 15/600 · optional muted value · chevron.
// Sections: Appearance · Notifications · Privacy · Billing · Legal · Security · Account.
// Notification toggles + the security/account rows are LIVE (persist to the
// backend); Appearance/Billing/Legal/Support remain display-only for now.
// Native primitives only; safe-area aware.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
// japa#145: the Subscription row shows the LIVE plan name (GET /subscriptions/me
// matched against GET /plans), never a default "Free". Loading → small coral
// spinner; failed → InlineError + "Try again" under the row.
import { usePlans, useMySubscription } from '@/hooks/useSubscription';
import { InlineError } from '@/components/explorer/AccountForm';
import { OutlineButton, RETRY_LABEL } from '@/components/explorer/states';
// Real Firebase sign-out (invoked after the confirm dialog) + account state
// (email-verified flag, whether this is a password account) used to gate the
// account-security rows below.
import { authService } from '@/services/auth.service';
// Notification channel prefs are read from the cached profile + persisted through
// the auth store (PATCH /users/me/notification-preferences).
import { useAuthStore } from '@/stores/auth.store';
// Feedback button toggle (issue #257).
import { FEEDBACK_ENABLED } from '@/config/feedback';
import { FEEDBACK_COPY } from '@/components/feedback/feedbackLogic';
import { useSettingsStore } from '@/stores/settings.store';
// Privacy row value (#172): approved / included in plan / not approved / off for all.
import { useAiMessageAccessState } from '@/hooks/useAiMessageAccess';
import {
  AI_COPY,
  settingsRowValue,
} from '@/components/explorer/aiMessageAccessLogic';

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
  // applied.
  const [theme, setTheme] = useState<'System' | 'Light' | 'Dark'>('System');

  // ── Notification channel prefs (email/push) — real, persisted ───────────────
  // Seed from the cached profile (absent = both on, the opt-out default), and keep
  // the switches in sync if the profile is (re)hydrated after mount. Writes go
  // through the store, which persists via the backend and updates the profile.
  const notificationPreferences = useAuthStore(
    (s) => s.profile?.notificationPreferences,
  );
  const updateNotificationPreferences = useAuthStore(
    (s) => s.updateNotificationPreferences,
  );
  const [pushOn, setPushOn] = useState(notificationPreferences?.push ?? true);
  const [emailOn, setEmailOn] = useState(
    notificationPreferences?.email ?? true,
  );

  useEffect(() => {
    if (notificationPreferences) {
      setPushOn(notificationPreferences.push);
      setEmailOn(notificationPreferences.email);
    }
  }, [notificationPreferences]);

  // Optimistically flip the switch, then persist. On failure, revert + alert so the
  // UI never claims a preference the server didn't accept.
  const toggleChannel = async (channel: 'email' | 'push', next: boolean) => {
    const setLocal = channel === 'email' ? setEmailOn : setPushOn;
    setLocal(next);
    const ok = await updateNotificationPreferences({ [channel]: next });
    if (!ok) {
      setLocal(!next);
      Alert.alert(
        'Couldn’t update',
        'We couldn’t save that change. Please try again.',
      );
    }
  };

  // Feedback button toggle (default on, persisted on the device).
  const feedbackOn = useSettingsStore((s) => s.feedbackButtonEnabled);
  const setFeedbackOn = useSettingsStore((s) => s.setFeedbackButtonEnabled);

  // AI message access state for the Privacy row. No value while loading or when
  // loading failed: the row still opens the screen, which shows the error.
  const aiAccessState = useAiMessageAccessState();
  const aiAccessValue = settingsRowValue(aiAccessState.data);

  // Subscription tier label from live data. A loaded `subscription: null`
  // means no paid plan → the zero-price plan's real name from GET /plans.
  const mine = useMySubscription();
  const plansQ = usePlans('client');
  const planLoading =
    (mine.isLoading && !mine.data) || (plansQ.isLoading && !plansQ.data);
  const planFailed =
    (mine.isError && !mine.data) || (plansQ.isError && !plansQ.data);
  const planId = mine.data?.subscription?.planId;
  const currentPlanName = (() => {
    if (!mine.data || !plansQ.data) return undefined;
    const plan = planId
      ? plansQ.data.find((p) => p.id === planId)
      : plansQ.data.find((p) => p.priceKobo === 0);
    return plan?.name;
  })();
  const retryPlan = () => {
    if (mine.isError) mine.refetch();
    if (plansQ.isError) plansQ.refetch();
  };

  // ── Account-security state ──────────────────────────────────────────────────
  // Password/email changes only apply to email/password accounts (phone-only users
  // have no password to reauthenticate with), so those rows are hidden otherwise.
  // The email-verified flag drives the "Verify email" row's status value.
  const hasPassword = authService.hasPasswordProvider();
  const emailVerified = authService.isEmailVerified();

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

  // ── Sign out: confirm, then real Firebase logout + return to auth entry ─────
  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await authService.logout();
          } finally {
            router.replace('/(auth)/welcome');
          }
        },
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
                onValueChange={(v) => toggleChannel('push', v)}
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
                onValueChange={(v) => toggleChannel('email', v)}
                trackColor={switchTrack}
                thumbColor="#fff"
                ios_backgroundColor={EX.color.line10}
              />
            }
          />
        </Card>

        {/* ── 2b. Privacy (AI message access, #172) ──────────────────────── */}
        <View style={{ height: 22 }} />
        <GroupLabel>{AI_COPY.settingsGroup}</GroupLabel>
        <Card>
          <SettingsRow
            icon={Ic.spark}
            label={AI_COPY.settingsRow}
            value={aiAccessValue}
            onPress={() => router.push('/ai-message-access')}
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
            right={
              planLoading ? (
                <ActivityIndicator size="small" color={EX.color.primary} />
              ) : undefined
            }
            onPress={() => router.push('/subscription')}
          />
          {planFailed ? (
            <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
              <InlineError message="We couldn’t load your plan. Try again." />
              {mine.isRefetching || plansQ.isRefetching ? (
                <ActivityIndicator
                  color={EX.color.primary}
                  style={{ alignSelf: 'flex-start' }}
                />
              ) : (
                <OutlineButton
                  label={RETRY_LABEL}
                  onPress={retryPlan}
                  style={{ alignSelf: 'flex-start' }}
                />
              )}
            </View>
          ) : null}
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
          {/* Shown unless the build removed the feature (EXPO_PUBLIC_FEEDBACK_ENABLED=false). */}
          {FEEDBACK_ENABLED ? (
            <SettingsRow
              icon={Ic.spark}
              label={FEEDBACK_COPY.settingsLabel}
              divider
              right={
                <Switch
                  value={feedbackOn}
                  onValueChange={setFeedbackOn}
                  trackColor={switchTrack}
                  thumbColor="#fff"
                  ios_backgroundColor={EX.color.line10}
                />
              }
            />
          ) : null}
        </Card>
        {FEEDBACK_ENABLED ? (
          <Text
            style={{
              fontSize: 12.5,
              lineHeight: 18,
              color: EX.color.inkMuted,
              marginTop: 8,
              marginHorizontal: 4,
            }}
          >
            {FEEDBACK_COPY.settingsCaption}
          </Text>
        ) : null}

        {/* ── 6. Security ────────────────────────────────────────────────── */}
        {/* Self-service account-security actions. Change password/email only make
            sense for email/password accounts, so they're gated on `hasPassword`. */}
        <View style={{ height: 22 }} />
        <GroupLabel>Security</GroupLabel>
        <Card>
          <SettingsRow
            icon={Ic.check2}
            label="Verify email"
            value={emailVerified ? 'Verified' : 'Not verified'}
            onPress={() => router.push('/verify-email')}
          />
          {hasPassword ? (
            <SettingsRow
              icon={Ic.shield}
              label="Change password"
              divider
              onPress={() => router.push('/change-password')}
            />
          ) : null}
          {hasPassword ? (
            <SettingsRow
              icon={Ic.msg}
              label="Change email"
              divider
              onPress={() => router.push('/change-email')}
            />
          ) : null}
        </Card>

        {/* ── 7. Account ─────────────────────────────────────────────────── */}
        <View style={{ height: 22 }} />
        <GroupLabel>Account</GroupLabel>
        <Card>
          <SettingsRow
            icon={Ic.arrow}
            label="Sign out"
            onPress={confirmSignOut}
          />
          <SettingsRow
            icon={Ic.x}
            label="Delete account"
            danger
            divider
            onPress={() => router.push('/delete-account')}
          />
        </Card>

        {/* ── 8. Footer ──────────────────────────────────────────────────── */}
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
