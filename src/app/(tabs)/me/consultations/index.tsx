import { ScrollView, View, TouchableOpacity, Text } from 'react-native';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useConsultations } from '@/hooks/useConsultations';
import { ConsultationCard } from '@/components/consultations/ConsultationCard';
import { Consultation } from '@/types/consultations.type';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Chip } from '@/components/ui/themed';

const FILTERS = [
  { label: 'Upcoming', icon: Clock },
  { label: 'Completed', icon: CheckCircle2 },
  { label: 'Cancelled', icon: AlertCircle },
];

export default function ConsultationsScreen() {
  const { consultations } = useConsultations();
  const { isDark, colors } = useTheme();

  const handleConsultationPress = (consultation: Consultation) => {
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

        {/* Status Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        >
          {FILTERS.map((filter, index, arr) => (
            <View
              key={filter.label}
              style={{ marginRight: index < arr.length - 1 ? 8 : 0 }}
            >
              <Chip selected={index === 0}>
                <View className="flex-row items-center">
                  <filter.icon
                    size={16}
                    color={index === 0 ? '#fff' : colors.iconMuted}
                  />
                  <Text
                    className={cn(
                      'ml-2',
                      index === 0
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
            </View>
          ))}
        </ScrollView>

        {/* Consultations List */}
        <View className="px-4">
          {consultations.map((consultation: Consultation) => (
            <TouchableOpacity
              key={consultation.id}
              onPress={() => handleConsultationPress(consultation)}
              activeOpacity={0.7}
            >
              <ConsultationCard consultation={consultation} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
