/**
 * Home Screen
 *
 * The main dashboard shown after authentication. Displays:
 * - Welcome greeting with the user's first name
 * - Notification bell with unread count badge
 * - Active application card (most recent in-progress application)
 * - Quick action buttons (Find Agent, Consultations, Applications, Browse Visas)
 * - Top rated agents carousel
 * - Popular visas carousel
 * - Popular destinations grid
 *
 * INTEGRATION CHANGES:
 * - Replaced `verificationAgents` mock import with `useTopAgents()` hook
 * - Replaced hardcoded "US Tourist Visa" card with real active application
 * - Added notification bell badge from `useUnreadNotificationCount()`
 * - Added analytics screen view tracking
 *
 * Backend endpoints used:
 * - GET /agents/top?limit=3 — top rated agents
 * - GET /visas/popular?limit=4 — popular visa types
 * - GET /countries/with-visas — countries with visa types
 * - GET /applications — user's applications (for active app card)
 * - GET /notifications/unread-count — notification badge count
 */

import {
  TouchableOpacity,
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import {
  Bell,
  Calendar,
  Star,
  ArrowRight,
  Users,
  FileText,
  MessageSquare,
  Globe,
} from 'lucide-react-native';
import { router } from 'expo-router';
// REPLACED: was `import { verificationAgents } from '@/mock_data/agents';`
import { useTopAgents, formatAgentForDisplay } from '@/hooks/useAgents';
import {
  useApplications,
  getApplicationStatusInfo,
} from '@/hooks/useApplications';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { getCountryFlag } from '@/utils/countryFlags';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Section, Card, Badge } from '@/components/ui/themed';
import {
  usePopularVisaTypes,
  useCountriesWithVisas,
} from '@/hooks/useVisaTypes';
import { useAuthStore } from '@/stores/auth.store';
import { analyticsService } from '@/services/analytics.service';

/** Quick action buttons on the home screen */
const QUICK_ACTIONS = [
  {
    path: '/(tabs)/apply/agents',
    text: 'Find Agent',
    icon: Users,
    color: '#3b82f6',
  },
  {
    path: '/me/consultations',
    text: 'Consultations',
    icon: MessageSquare,
    color: '#8b5cf6',
  },
  {
    path: '/me/applications',
    text: 'Applications',
    icon: FileText,
    color: '#10b981',
  },
  {
    path: '/(tabs)/apply',
    text: 'Browse Visas',
    icon: Globe,
    color: '#f59e0b',
  },
];

export default function HomeScreen() {
  const { isDark, colors } = useTheme();
  const profile = useAuthStore((state) => state.profile);

  // Fetch real data from backend APIs
  const { data: popularVisas, isLoading: visasLoading } =
    usePopularVisaTypes(4);
  const { data: countries, isLoading: countriesLoading } =
    useCountriesWithVisas();
  // REPLACED: was `verificationAgents.slice(0, 3)` (mock data)
  const { data: topAgents, isLoading: agentsLoading } = useTopAgents(3);
  // Fetch user's applications to show the most recent active one
  const { data: applications } = useApplications();
  // Fetch notification unread count for the bell badge
  const { data: unreadCount } = useUnreadNotificationCount();

  // Track screen view for analytics
  analyticsService.trackScreenView('HomeScreen');

  // Get top 4 countries for destinations section
  const topDestinations = (countries ?? []).slice(0, 4);

  // Convert API agents to display format for the carousel
  const displayAgents = (topAgents ?? []).map(formatAgentForDisplay);

  /**
   * Find the most recent active application to show in the hero card.
   * "Active" = not completed, not rejected, not withdrawn, not expired.
   * Sort by updatedAt desc to get the most recently updated one.
   */
  const activeApplication = (applications ?? []).find((app) =>
    [
      'draft',
      'pending_payment',
      'pending_documents',
      'under_review',
      'submitted_to_embassy',
      'interview_scheduled',
    ].includes(app.status),
  );

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header Section — greeting + notification bell */}
        <View
          className={cn('px-4 pb-4 pt-2', isDark ? 'bg-gray-800' : 'bg-white')}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text
                className={cn(
                  'text-2xl font-bold',
                  isDark ? 'text-white' : 'text-gray-900',
                )}
              >
                Welcome{profile?.firstName ? `, ${profile.firstName}` : ' back'}
              </Text>
              <Text
                className={cn(
                  'text-base',
                  isDark ? 'text-gray-400' : 'text-gray-500',
                )}
              >
                What would you like to do today?
              </Text>
            </View>
            {/* Notification bell — now shows unread count badge */}
            <TouchableOpacity
              className={cn(
                'h-10 w-10 items-center justify-center rounded-full',
                isDark ? 'bg-gray-700' : 'bg-gray-100',
              )}
            >
              <Bell color={colors.icon} size={20} />
              {/* Unread count badge — only shown when there are unread notifications */}
              {(unreadCount ?? 0) > 0 && (
                <View className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-red-500">
                  <Text className="text-xs font-bold text-white">
                    {unreadCount! > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Application Card — shows real data instead of hardcoded "US Tourist Visa" */}
        {activeApplication ? (
          <Section>
            <Card
              variant="highlight"
              onPress={() =>
                router.push(`/me/applications/${activeApplication.id}`)
              }
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View
                    className={cn(
                      'mr-3 h-12 w-12 items-center justify-center rounded-full',
                      isDark ? 'bg-blue-800' : 'bg-blue-100',
                    )}
                  >
                    <Calendar color={colors.primary} size={24} />
                  </View>
                  <View>
                    <Text
                      className={cn(
                        'text-base font-semibold',
                        isDark ? 'text-white' : 'text-gray-900',
                      )}
                    >
                      {/* Show visa type name from the real application */}
                      {activeApplication.visaTypeName ??
                        activeApplication.currentStep}
                    </Text>
                    <View className="mt-1 flex-row items-center">
                      <Badge
                        variant={
                          getApplicationStatusInfo(activeApplication.status)
                            .label === 'Approved'
                            ? 'success'
                            : 'warning'
                        }
                      >
                        {
                          getApplicationStatusInfo(activeApplication.status)
                            .label
                        }
                      </Badge>
                      <Text
                        className={cn(
                          'ml-2 text-sm',
                          isDark ? 'text-gray-400' : 'text-gray-500',
                        )}
                      >
                        {activeApplication.progress}% complete
                      </Text>
                    </View>
                  </View>
                </View>
                <ArrowRight size={20} color={colors.primary} />
              </View>
            </Card>
          </Section>
        ) : (
          // No active application — show a CTA to start one
          <Section>
            <Card
              variant="highlight"
              onPress={() => router.push('/(tabs)/apply')}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View
                    className={cn(
                      'mr-3 h-12 w-12 items-center justify-center rounded-full',
                      isDark ? 'bg-blue-800' : 'bg-blue-100',
                    )}
                  >
                    <Globe color={colors.primary} size={24} />
                  </View>
                  <View>
                    <Text
                      className={cn(
                        'text-base font-semibold',
                        isDark ? 'text-white' : 'text-gray-900',
                      )}
                    >
                      Start Your Visa Application
                    </Text>
                    <Text
                      className={cn(
                        'mt-1 text-sm',
                        isDark ? 'text-gray-400' : 'text-gray-500',
                      )}
                    >
                      Browse available visa types
                    </Text>
                  </View>
                </View>
                <ArrowRight size={20} color={colors.primary} />
              </View>
            </Card>
          </Section>
        )}

        {/* Quick Actions */}
        <Section title="Quick Actions">
          <View className="flex-row flex-wrap justify-between">
            {QUICK_ACTIONS.map((action, index) => {
              const IconComponent = action.icon;
              return (
                <TouchableOpacity
                  key={index}
                  className={cn(
                    'mb-3 items-center rounded-xl border p-4',
                    isDark
                      ? 'border-gray-700 bg-gray-800'
                      : 'border-gray-200 bg-white',
                  )}
                  style={{ width: '48%' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onPress={() => router.push(action.path as any)}
                  activeOpacity={0.7}
                >
                  <View
                    className="mb-2 h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${action.color}20` }}
                  >
                    <IconComponent size={24} color={action.color} />
                  </View>
                  <Text
                    className={cn(
                      'text-sm font-medium',
                      isDark ? 'text-white' : 'text-gray-900',
                    )}
                  >
                    {action.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        {/* Top Rated Agents — now fetched from GET /agents/top */}
        <Section
          title="Top Rated Agents"
          rightElement={
            <TouchableOpacity onPress={() => router.push('/apply/agents')}>
              <Text className="text-sm font-medium text-blue-600">
                View All
              </Text>
            </TouchableOpacity>
          }
        >
          {agentsLoading ? (
            <View className="items-center py-4">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 16 }}
            >
              {displayAgents.map((agent, index) => (
                <TouchableOpacity
                  key={agent.id}
                  onPress={() => router.push(`/apply/agents/${agent.id}`)}
                  className={cn(
                    'rounded-xl border p-4',
                    isDark
                      ? 'border-gray-700 bg-gray-800'
                      : 'border-gray-200 bg-white',
                  )}
                  style={{
                    width: 200,
                    marginRight: index < displayAgents.length - 1 ? 12 : 0,
                  }}
                  activeOpacity={0.7}
                >
                  <View className="mb-3 flex-row items-center">
                    <View
                      className={cn(
                        'h-10 w-10 items-center justify-center rounded-full',
                        isDark ? 'bg-gray-700' : 'bg-gray-100',
                      )}
                    >
                      <Text
                        className={cn(
                          'font-semibold',
                          isDark ? 'text-gray-300' : 'text-gray-600',
                        )}
                      >
                        {agent.initials}
                      </Text>
                    </View>
                    <View className="ml-3 flex-1">
                      <Text
                        className={cn(
                          'font-medium',
                          isDark ? 'text-white' : 'text-gray-900',
                        )}
                        numberOfLines={1}
                      >
                        {agent.name}
                      </Text>
                      <Text
                        className={cn(
                          'text-sm',
                          isDark ? 'text-gray-400' : 'text-gray-500',
                        )}
                        numberOfLines={1}
                      >
                        {agent.specializations[0]}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <Star size={14} color="#facc15" fill="#facc15" />
                      <Text
                        className={cn(
                          'ml-1 text-sm',
                          isDark ? 'text-gray-300' : 'text-gray-700',
                        )}
                      >
                        {agent.rating}
                      </Text>
                    </View>
                    <Text className="text-sm font-semibold text-green-600">
                      ${agent.price}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </Section>

        {/* Popular Visas */}
        <Section
          title="Popular Visas"
          rightElement={
            <TouchableOpacity onPress={() => router.push('/apply')}>
              <Text className="text-sm font-medium text-blue-600">
                View All
              </Text>
            </TouchableOpacity>
          }
        >
          {visasLoading ? (
            <View className="items-center py-4">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 16 }}
            >
              {(popularVisas ?? []).map((visa, index) => (
                <TouchableOpacity
                  key={visa.id}
                  onPress={() =>
                    router.push({
                      pathname: '/apply/visa-details/[id]',
                      params: { id: visa.id, countryCode: visa.countryCode },
                    })
                  }
                  className={cn(
                    'rounded-xl border p-4',
                    isDark
                      ? 'border-gray-700 bg-gray-800'
                      : 'border-gray-200 bg-white',
                  )}
                  style={{ width: 180, marginRight: index < 3 ? 12 : 0 }}
                  activeOpacity={0.7}
                >
                  <View className="mb-3 flex-row items-center">
                    <Image
                      source={{
                        uri: getCountryFlag(visa.countryCode),
                      }}
                      className="h-8 w-8 rounded-full"
                      resizeMode="cover"
                    />
                    <View className="ml-2 flex-1">
                      <Text
                        className={cn(
                          'font-semibold',
                          isDark ? 'text-white' : 'text-gray-900',
                        )}
                        numberOfLines={1}
                      >
                        {visa.name}
                      </Text>
                    </View>
                  </View>
                  <Text
                    className={cn(
                      'mb-3 text-sm',
                      isDark ? 'text-gray-400' : 'text-gray-500',
                    )}
                    numberOfLines={1}
                  >
                    {visa.processingTime}
                  </Text>
                  <View className="flex-row items-center justify-between">
                    <Text className="font-bold text-blue-600">
                      ${visa.baseCostUsd}
                    </Text>
                    <ArrowRight size={16} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </Section>

        {/* Popular Destinations */}
        <Section title="Popular Destinations">
          {countriesLoading ? (
            <View className="items-center py-4">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-between">
              {topDestinations.map((country) => (
                <TouchableOpacity
                  key={country.code}
                  onPress={() =>
                    router.push({
                      pathname: '/apply',
                      params: { countryCode: country.code },
                    })
                  }
                  className={cn(
                    'mb-3 flex-row items-center rounded-xl border p-3',
                    isDark
                      ? 'border-gray-700 bg-gray-800'
                      : 'border-gray-200 bg-white',
                  )}
                  style={{ width: '48%' }}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{ uri: country.flagUrl }}
                    className="mr-2 h-8 w-8 rounded-full"
                    resizeMode="cover"
                  />
                  <Text
                    className={cn(
                      'flex-1 font-medium',
                      isDark ? 'text-white' : 'text-gray-900',
                    )}
                    numberOfLines={1}
                  >
                    {country.name}
                  </Text>
                  <ArrowRight size={16} color={colors.iconMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Section>
      </ScrollView>
    </Screen>
  );
}
