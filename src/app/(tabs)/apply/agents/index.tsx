import { useState } from 'react';
import { ScrollView, View, TouchableOpacity, Text } from 'react-native';
import { Search, Users, Star, Filter } from 'lucide-react-native';
import { Link } from 'expo-router';
import { AgentCard } from '@/components/agents/AgentCard';
import { verificationAgents } from '@/mock_data/agents';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Section, Input, Chip } from '@/components/ui/themed';

const FILTERS = [
  'All',
  'Top Rated',
  'Student Visa',
  'Work Visa',
  'Tourist Visa',
];

export default function AgentsScreen() {
  const { isDark, colors } = useTheme();
  const [selectedFilter, setSelectedFilter] = useState(0);

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header Section */}
        <View
          className={cn('px-4 pb-4 pt-2', isDark ? 'bg-gray-800' : 'bg-white')}
        >
          <View className="mb-1 flex-row items-center">
            <View
              className={cn(
                'mr-3 h-10 w-10 items-center justify-center rounded-full',
                isDark ? 'bg-blue-900/50' : 'bg-blue-100',
              )}
            >
              <Users size={20} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text
                className={cn(
                  'text-2xl font-bold',
                  isDark ? 'text-white' : 'text-gray-900',
                )}
              >
                Find an Agent
              </Text>
              <Text
                className={cn(
                  'text-sm',
                  isDark ? 'text-gray-400' : 'text-gray-500',
                )}
              >
                Expert visa consultants ready to help
              </Text>
            </View>
          </View>

          {/* Stats Row */}
          <View
            className={cn(
              'mt-4 flex-row rounded-xl p-3',
              isDark ? 'bg-gray-700/50' : 'bg-gray-50',
            )}
          >
            <View
              className={cn(
                'flex-1 items-center border-r',
                isDark ? 'border-gray-600' : 'border-gray-200',
              )}
            >
              <Text
                className={cn(
                  'text-xl font-bold',
                  isDark ? 'text-white' : 'text-gray-900',
                )}
              >
                {verificationAgents.length}
              </Text>
              <Text
                className={cn(
                  'text-xs',
                  isDark ? 'text-gray-400' : 'text-gray-500',
                )}
              >
                Available
              </Text>
            </View>
            <View
              className={cn(
                'flex-1 items-center border-r',
                isDark ? 'border-gray-600' : 'border-gray-200',
              )}
            >
              <View className="flex-row items-center">
                <Star size={14} color="#facc15" />
                <Text
                  className={cn(
                    'ml-1 text-xl font-bold',
                    isDark ? 'text-white' : 'text-gray-900',
                  )}
                >
                  4.8
                </Text>
              </View>
              <Text
                className={cn(
                  'text-xs',
                  isDark ? 'text-gray-400' : 'text-gray-500',
                )}
              >
                Avg Rating
              </Text>
            </View>
            <View className="flex-1 items-center">
              <Text
                className={cn(
                  'text-xl font-bold',
                  isDark ? 'text-white' : 'text-gray-900',
                )}
              >
                95%
              </Text>
              <Text
                className={cn(
                  'text-xs',
                  isDark ? 'text-gray-400' : 'text-gray-500',
                )}
              >
                Success Rate
              </Text>
            </View>
          </View>

          {/* Search Bar */}
          <View className="mt-4">
            <Input
              placeholder="Search by name, specialization..."
              icon={<Search size={20} color={colors.placeholder} />}
            />
          </View>
        </View>

        {/* Filters */}
        <View
          className={cn(
            'border-b',
            isDark ? 'border-gray-800' : 'border-gray-100',
          )}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            {FILTERS.map((filter, index) => (
              <TouchableOpacity
                key={filter}
                onPress={() => setSelectedFilter(index)}
                style={{ marginRight: index < FILTERS.length - 1 ? 8 : 0 }}
              >
                <Chip selected={selectedFilter === index}>{filter}</Chip>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Results Count */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text
            className={cn(
              'font-medium',
              isDark ? 'text-gray-300' : 'text-gray-700',
            )}
          >
            {verificationAgents.length} agents found
          </Text>
          <TouchableOpacity className="flex-row items-center">
            <Filter size={16} color={colors.iconMuted} />
            <Text
              className={cn(
                'ml-1 text-sm',
                isDark ? 'text-gray-400' : 'text-gray-500',
              )}
            >
              Sort by
            </Text>
          </TouchableOpacity>
        </View>

        {/* Agents List */}
        <Section className="pt-0">
          {verificationAgents.map((agent) => (
            <Link key={agent.id} href={`/apply/agents/${agent.id}`} asChild>
              <TouchableOpacity activeOpacity={0.7}>
                <AgentCard agent={agent} />
              </TouchableOpacity>
            </Link>
          ))}
        </Section>
      </ScrollView>
    </Screen>
  );
}
