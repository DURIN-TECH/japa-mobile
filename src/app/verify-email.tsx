// ─────────────────────────────────────────────────────────────────────────────
// Verify email (Explorer, account security).
//
// Shows whether the signed-in account's email is verified. When it isn't, the user
// can (re)send the branded verification email (backend → Resend) and, after tapping
// the link in their inbox, hit "I’ve verified" to force-refresh the Firebase user
// and flip this screen to the verified state. Firebase sign-up sends no verification
// email on its own, so this screen is the app's home for that flow.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { BackHeader, CoralSubmit } from '@/components/explorer/AccountForm';
import { Ic } from '@/components/explorer/icons';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';

// Big circular status badge (mirrors verify-identity.tsx).
function StatusBadge({
  icon: IconCmp,
  fg,
  bg,
}: {
  icon: React.ElementType;
  fg: string;
  bg: string;
}) {
  return (
    <View
      style={{
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
      }}
    >
      <IconCmp size={44} color={fg} strokeWidth={1.8} />
    </View>
  );
}

export default function VerifyEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sendEmailVerification = useAuthStore((s) => s.sendEmailVerification);
  const email = useAuthStore((s) => s.user?.email ?? s.profile?.email ?? '');

  // Seed from the cached user; refreshed on demand via "I’ve verified".
  const [verified, setVerified] = useState(authService.isEmailVerified());
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);

  // Resend the branded verification email (best-effort; always shows the same
  // reassuring message so we never leak whether an address exists/needs verifying).
  const onResend = async () => {
    setSending(true);
    try {
      await sendEmailVerification(email || undefined);
      Alert.alert(
        'Verification sent',
        `If ${email || 'your address'} needs verifying, we’ve emailed a link. Check your inbox (and spam).`,
      );
    } finally {
      setSending(false);
    }
  };

  // Force-refresh the Firebase user so a just-clicked link is reflected here.
  const onCheck = async () => {
    setChecking(true);
    try {
      const user = await authService.reloadUser();
      const isVerified = !!user?.emailVerified;
      setVerified(isVerified);
      if (!isVerified) {
        Alert.alert(
          'Not verified yet',
          'We haven’t seen your email confirmed yet. Tap the link in the email, then try again.',
        );
      }
    } finally {
      setChecking(false);
    }
  };

  // ── VERIFIED — success state, no actions ────────────────────────────────────
  if (verified) {
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
        <BackHeader
          title="Verify email"
          insets={insets}
          onBack={() => router.back()}
        />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
            gap: 20,
          }}
        >
          <StatusBadge
            icon={Ic.check2}
            fg={EX.color.tealDeep}
            bg={EX.color.tealTint14}
          />
          <Text style={[displayText(24, 'semibold'), { textAlign: 'center' }]}>
            Your email is verified
          </Text>
          <Text
            style={{
              fontSize: 14.5,
              lineHeight: 21,
              color: EX.color.inkMuted,
              textAlign: 'center',
              maxWidth: 300,
            }}
          >
            {email ? `${email} is confirmed. ` : ''}You’re all set to receive
            important updates about your applications.
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: EX.space.screenX,
            paddingBottom: Math.max(insets.bottom, 16) + 6,
            paddingTop: 8,
          }}
        >
          <CoralSubmit label="Done" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  // ── UNVERIFIED — resend + re-check actions ──────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      <BackHeader
        title="Verify email"
        subtitle="Confirm your email to secure your account"
        insets={insets}
        onBack={() => router.back()}
      />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
          gap: 18,
        }}
      >
        <StatusBadge icon={Ic.msg} fg="#2F62A0" bg="#DCEBF7" />
        <Text style={[displayText(24, 'semibold'), { textAlign: 'center' }]}>
          Check your inbox
        </Text>
        <Text
          style={{
            fontSize: 14.5,
            lineHeight: 21,
            color: EX.color.inkMuted,
            textAlign: 'center',
            maxWidth: 300,
          }}
        >
          {email ? `We’ll send a verification link to ${email}. ` : ''}Tap the
          link, then come back and confirm below.
        </Text>

        {/* Secondary "I’ve verified — refresh" action. */}
        <Pressable
          onPress={onCheck}
          disabled={checking}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 16,
          }}
        >
          {checking ? (
            <ActivityIndicator color={EX.color.primary} size="small" />
          ) : (
            <Ic.check size={16} color={EX.color.primary} strokeWidth={2.4} />
          )}
          <Text
            style={{
              fontSize: 14.5,
              fontWeight: '700',
              color: EX.color.primary,
            }}
          >
            I’ve verified — refresh
          </Text>
        </Pressable>
      </View>

      <View
        style={{
          paddingHorizontal: EX.space.screenX,
          paddingBottom: Math.max(insets.bottom, 16) + 6,
          paddingTop: 8,
        }}
      >
        <CoralSubmit
          label="Resend verification email"
          onPress={onResend}
          loading={sending}
        />
      </View>
    </View>
  );
}
