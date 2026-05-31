/**
 * Consultations List Screen
 *
 * Shows the user's consultations with agents, filterable by status.
 *
 * INTEGRATION CHANGE: Previously used the mock-based `useConsultations()`
 * hook that returned hardcoded MOCK_CONSULTATIONS. Now uses the rewritten
 * hook that fetches from GET /consultations.
 *
 * The component also updated from the old `Consultation` type (with `date: Date`)
 * to the new `ApiConsultation` type (with `scheduledDate: string`).
 *
 * Backend endpoint: GET /consultations
 * Hook: useConsultations(status?) from @/hooks/useConsultations
 */

import { useState } from 'react';
import {
  ScrollView,
  View,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  MessageSquare,
} from 'lucide-react-native';
import { router } from 'expo-router';
// REPLACED: was using the old mock-based hook and old Consultation type
import {
  useConsultations,
  type ApiConsultation,
  getConsultationDisplayStatus,
} from '@/hooks/useConsultations';
import { ConsultationCard } from '@/components/consultations/ConsultationCard';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Chip } from '@/components/ui/themed';

/**
 * Filter tabs matching the simplified display statuses.
 * Users can filter by upcoming, completed, or cancelled.
 */
const FILTERS = [
  { label: 'Upcoming', icon: Clock, displayStatus: 'upcoming' as const },
  {
    label: 'Completed',
    icon: CheckCircle2,
    displayStatus: 'completed' as const,
  },
  {
    label: 'Cancelled',
    icon: AlertCircle,
    displayStatus: 'cancelled' as const,
  },
];

export default function ConsultationsScreen() {
  const [selectedFilter, setSelectedFilter] = useState(0);
  const { isDark, colors } = useTheme();

  // Fetch all consultations from the API (no server-side filter — filter client-side)
  const { data: consultations, isLoading } = useConsultations();

  /**
   * Filter consultations by the selected display status.
   * We use getConsultationDisplayStatus() to map backend statuses
   * (scheduled, confirmed, completed, cancelled, no_show, etc.)
   * to the simplified display statuses (upcoming, completed, cancelled).
   */
  const filteredConsultations = (consultations ?? []).filter((c) => {
    const displayStatus = getConsultationDisplayStatus(c.status);
    return displayStatus === FILTERS[selectedFilter].displayStatus;
  });

  const handleConsultationPress = (consultation: ApiConsultation) => {
    router.push({
      pathname: '/me/consultations/[id]' as const,
      params: { id: consultation.id },
    });
  };

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <View
          className={cn('px-4 pb-2 pt-1', isDark ? 'bg-gray-800' : 'bg-white')}
        >
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-3 p-1"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <View>
              <Text
                className={cn(
                  'text-xl font-bold',
                  isDark ? 'text-white' : 'text-gray-900',
                )}
              >
                My Consultations
              </Text>
              <Text
                className={cn(
                  'text-sm',
                  isDark ? 'text-gray-400' : 'text-gray-500',
                )}
              >
                View your scheduled consultations
              </Text>
            </View>
          </View>
        </View>

        {/* Status Filters — interactive (was display-only before) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        >
          {FILTERS.map((filter, index, arr) => (
            <TouchableOpacity
              key={filter.label}
              onPress={() => setSelectedFilter(index)}
              style={{ marginRight: index < arr.length - 1 ? 8 : 0 }}
            >
              <Chip selected={selectedFilter === index}>
                <View className="flex-row items-center">
                  <filter.icon
                    size={16}
                    color={selectedFilter === index ? '#fff' : colors.iconMuted}
                  />
                  <Text
                    className={cn(
                      'ml-2',
                      selectedFilter === index
                        ? 'text-white'
                        : isDark
                          ? 'text-gray-300'
                          : 'text-gray-700',
                    )}
                  >
                    {filter.label}
                  </Text>
                </View>
              </Chip>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Consultations List — Loading / Empty / Results */}
        <View className="px-4">
          {isLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator color={colors.primary} />
              <Text
                className={cn(
                  'mt-2 text-sm',
                  isDark ? 'text-gray-400' : 'text-gray-500',
                )}
              >
                Loading consultations...
              </Text>
            </View>
          ) : filteredConsultations.length === 0 ? (
            <View className="items-center py-8">
              <MessageSquare size={40} color={colors.iconMuted} />
              <Text
                className={cn(
                  'mt-2 text-center',
                  isDark ? 'text-gray-400' : 'text-gray-500',
                )}
              >
                No {FILTERS[selectedFilter].label.toLowerCase()} consultations
              </Text>
            </View>
          ) : (
            filteredConsultations.map((consultation) => (
              <TouchableOpacity
                key={consultation.id}
                onPress={() => handleConsultationPress(consultation)}
                activeOpacity={0.7}
              >
                <ConsultationCard consultation={consultation} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
