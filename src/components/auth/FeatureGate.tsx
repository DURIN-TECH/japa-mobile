import { ReactNode } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Lock } from 'lucide-react-native';
import { FeatureKey } from '@durin-tech/authz';
import { useFeature } from '@/hooks/useAuthorization';

interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  /** Custom locked UI; defaults to the upgrade Paywall. */
  fallback?: ReactNode;
  /** Render nothing (instead of a paywall) when the feature is locked. */
  hideWhenLocked?: boolean;
}

/**
 * Gates a subscription feature on mobile. Renders `children` when unlocked,
 * otherwise a paywall (or nothing, or a custom fallback). Backend still enforces;
 * this is UX only.
 *
 *   <FeatureGate feature="messaging"><ChatButton /></FeatureGate>
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  hideWhenLocked,
}: FeatureGateProps) {
  const unlocked = useFeature(feature);
  if (unlocked) return <>{children}</>;
  if (hideWhenLocked) return null;
  return <>{fallback ?? <Paywall feature={feature} />}</>;
}

/**
 * Upgrade prompt placeholder. Subscriptions are purchased on the **web portal**
 * (app-to-web purchase) so we avoid App Store / Play Billing IAP — the mobile app
 * just reads the resulting entitlement. The real checkout URL is wired in the
 * billing phase.
 */
export function Paywall({ feature }: { feature?: FeatureKey }) {
  const openUpgrade = () => {
    Linking.openURL('https://seli.app/upgrade').catch(() => undefined);
  };

  return (
    <View className="items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-blue-50">
        <Lock size={22} color="#2563eb" />
      </View>
      <Text className="mt-3 text-base font-semibold text-neutral-900">
        Premium feature
      </Text>
      <Text className="mt-1 text-center text-sm text-neutral-500">
        {feature
          ? 'This isn’t included in your current plan.'
          : 'Upgrade your plan to unlock this.'}
      </Text>
      <Pressable
        onPress={openUpgrade}
        className="mt-4 rounded-full bg-blue-600 px-6 py-3 active:opacity-80"
      >
        <Text className="font-semibold text-white">Upgrade your plan</Text>
      </Pressable>
    </View>
  );
}
