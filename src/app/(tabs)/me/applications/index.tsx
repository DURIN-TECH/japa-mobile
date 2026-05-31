import { ScrollView, View, TouchableOpacity, Text } from 'react-native';
import {
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { ApplicationCard } from '@/components/applications/ApplicationCard';
import { useApplications } from '@/hooks/useApplications';
import { Application } from '@/types/applications.type';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Chip } from '@/components/ui/themed';

const FILTERS = [
  { label: 'All', icon: FileText },
  { label: 'In Progress', icon: Clock },
  { label: 'Completed', icon: CheckCircle2 },
  { label: 'Issues', icon: AlertCircle },
];

export default function ApplicationsScreen() {
  const { applications } = useApplications();
  const { isDark, colors } = useTheme();

  const handleApplicationPress = (application: Application) => {
    router.push({
      pathname: '/me/applications/[id]' as const,
      params: { id: application.id },
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
                My Applications
              </Text>
              <Text
                className={cn(
                  'text-sm',
                  isDark ? 'text-gray-400' : 'text-gray-500',
                )}
              >
                Track your visa applications
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

        {/* Applications List */}
        <View className="px-4">
          {applications.map((application: Application) => (
            <TouchableOpacity
              key={application.id}
              onPress={() => handleApplicationPress(application)}
              activeOpacity={0.7}
            >
              <ApplicationCard application={application} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
