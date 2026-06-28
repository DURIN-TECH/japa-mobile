import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Check, Sparkles } from 'lucide-react-native';
import { router } from 'expo-router';
import { FeatureKey } from '@durin-tech/authz';
import { useTheme, cn } from '@/hooks/useTheme';
import {
  useMySubscription,
  usePlans,
  useStartCheckout,
  PlanDTO,
} from '@/hooks/useSubscription';

const FEATURE_LABELS: Record<string, string> = {
  'applications.create': 'Create applications',
  messaging: 'Agent messaging',
  'consultations.book': 'Book consultations',
  'documents.upload': 'Document uploads',
  self_service: 'Self-service flow',
  priority_support: 'Priority support',
  'news.alerts': 'Visa news alerts',
};

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString()}`;
const featureLabel = (f: FeatureKey) => FEATURE_LABELS[f] ?? f;

export default function SubscriptionScreen() {
  const { isDark, colors } = useTheme();
  const { data: mine, isLoading } = useMySubscription();
  const { data: plans = [] } = usePlans(mine?.subscriberType ?? 'client');
  const checkout = useStartCheckout();

  const currentPlanId = mine?.entitlements?.planId ?? null;

  const handleUpgrade = async (plan: PlanDTO) => {
    const url = await checkout.mutateAsync(plan.id);
    if (url) {
      // App-to-web: open the hosted Paystack checkout in the browser.
      Linking.openURL(url).catch(() => undefined);
    }
  };

  return (
    <SafeAreaView
      className={cn('flex-1', isDark ? 'bg-gray-900' : 'bg-gray-50')}
      edges={['top']}
    >
      {/* Header */}
      <View
        className={cn(
          'flex-row items-center border-b px-4 py-3',
          isDark ? 'border-gray-800' : 'border-gray-200',
        )}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 p-1"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={24} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
        <Text
          className={cn(
            'text-xl font-bold',
            isDark ? 'text-white' : 'text-gray-900',
          )}
        >
          Subscription
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4 pt-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Current plan */}
          <View
            className={cn(
              'mb-6 rounded-2xl p-5',
              isDark ? 'bg-gray-800' : 'bg-white',
            )}
          >
            <Text
              className={cn(
                'text-xs uppercase',
                isDark ? 'text-gray-400' : 'text-gray-500',
              )}
            >
              Current plan
            </Text>
            <View className="mt-1 flex-row items-center">
              <Text
                className={cn(
                  'text-lg font-bold',
                  isDark ? 'text-white' : 'text-gray-900',
                )}
              >
                {plans.find((p) => p.id === currentPlanId)?.name ??
                  currentPlanId ??
                  'Free'}
              </Text>
              {mine?.unlimited && (
                <Sparkles size={16} color={colors.primary} className="ml-2" />
              )}
            </View>
            {mine?.entitlements?.features?.length ? (
              <View className="mt-3">
                {mine.entitlements.features.map((f) => (
                  <View key={f} className="flex-row items-center py-0.5">
                    <Check size={16} color="#16a34a" />
                    <Text
                      className={cn(
                        'ml-2 text-sm',
                        isDark ? 'text-gray-300' : 'text-gray-700',
                      )}
                    >
                      {featureLabel(f)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text
                className={cn(
                  'mt-2 text-sm',
                  isDark ? 'text-gray-400' : 'text-gray-500',
                )}
              >
                No paid features on your current plan.
              </Text>
            )}
          </View>

          {/* Available plans */}
          <Text
            className={cn(
              'mb-3 text-base font-semibold',
              isDark ? 'text-white' : 'text-gray-900',
            )}
          >
            Available plans
          </Text>
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            return (
              <View
                key={plan.id}
                className={cn(
                  'mb-4 rounded-2xl border p-5',
                  isCurrent
                    ? 'border-blue-500'
                    : isDark
                      ? 'border-gray-800 bg-gray-800'
                      : 'border-gray-100 bg-white',
                  isDark && !isCurrent
                    ? ''
                    : isDark
                      ? 'bg-gray-800'
                      : 'bg-white',
                )}
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className={cn(
                      'text-base font-semibold',
                      isDark ? 'text-white' : 'text-gray-900',
                    )}
                  >
                    {plan.name}
                  </Text>
                  {isCurrent && (
                    <Text className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      Current
                    </Text>
                  )}
                </View>
                <Text
                  className={cn(
                    'mt-1 text-2xl font-bold',
                    isDark ? 'text-white' : 'text-gray-900',
                  )}
                >
                  {plan.priceKobo === 0 ? 'Free' : naira(plan.priceKobo)}
                  {plan.priceKobo > 0 && plan.interval !== 'none' && (
                    <Text
                      className={cn(
                        'text-sm font-normal',
                        isDark ? 'text-gray-400' : 'text-gray-500',
                      )}
                    >
                      {' '}
                      /{plan.interval}
                    </Text>
                  )}
                </Text>

                <View className="mt-3">
                  {plan.features.map((f) => (
                    <View key={f} className="flex-row items-center py-0.5">
                      <Check size={16} color="#16a34a" />
                      <Text
                        className={cn(
                          'ml-2 text-sm',
                          isDark ? 'text-gray-300' : 'text-gray-700',
                        )}
                      >
                        {featureLabel(f)}
                      </Text>
                    </View>
                  ))}
                </View>

                {!isCurrent && (
                  <TouchableOpacity
                    onPress={() => handleUpgrade(plan)}
                    disabled={checkout.isPending}
                    className="mt-4 items-center rounded-full bg-blue-600 py-3 active:opacity-80"
                  >
                    <Text className="font-semibold text-white">
                      {checkout.isPending
                        ? 'Starting…'
                        : plan.priceKobo === 0
                          ? 'Switch to Free'
                          : 'Upgrade'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          <Text
            className={cn(
              'mt-2 text-center text-xs',
              isDark ? 'text-gray-500' : 'text-gray-400',
            )}
          >
            Upgrades open a secure checkout in your browser.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
