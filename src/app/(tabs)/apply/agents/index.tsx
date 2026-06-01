/**
 * Agents Listing Screen
 *
 * Shows a searchable, filterable directory of immigration agents.
 * Users can browse agents, view stats, and tap to see agent profiles.
 *
 * INTEGRATION CHANGE: Previously imported `verificationAgents` from mock data.
 * Now fetches real agents from GET /agents via the `useAgents` hook.
 * The `formatAgentForDisplay()` helper converts the API response to the
 * legacy display format expected by the AgentCard component.
 *
 * Backend endpoint: GET /agents
 * Hook: useAgents() from @/hooks/useAgents
 */

import { useState, useMemo } from 'react';
import {
  ScrollView,
  View,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { Search, Users, Star, Filter } from 'lucide-react-native';
import { Link } from 'expo-router';
import { AgentCard } from '@/components/agents/AgentCard';
import { useAgents, formatAgentForDisplay } from '@/hooks/useAgents';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Section, Input, Chip } from '@/components/ui/themed';
import { analyticsService } from '@/services/analytics.service';

/** Filter categories for the agent list */
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
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch agents from backend API (replaces mock verificationAgents)
  const { data: agents, isLoading } = useAgents();

  // Track screen view for analytics
  analyticsService.trackScreenView('AgentsScreen');

  /**
   * Apply search and filter to the agents list.
   * - Search matches against name, specializations, and languages
   * - Filters match against specializations (e.g. "Student Visa")
   * - "Top Rated" sorts by rating descending
   */
  const filteredAgents = useMemo(() => {
    if (!agents) return [];

    let result = agents;

    // Apply search filter — match name, specializations, or languages
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.displayName.toLowerCase().includes(query) ||
          a.specializations.some((s) => s.toLowerCase().includes(query)) ||
          a.languages.some((l) => l.toLowerCase().includes(query)),
      );
    }

    // Apply category filter
    const filterName = FILTERS[selectedFilter];
    if (filterName === 'Top Rated') {
      // Sort by rating descending for "Top Rated" filter
      result = [...result].sort((a, b) => b.rating - a.rating);
    } else if (filterName !== 'All') {
      // Filter by specialization (e.g. "Student Visa", "Work Visa")
      result = result.filter((a) =>
        a.specializations.some((s) =>
          s.toLowerCase().includes(filterName.toLowerCase()),
        ),
      );
    }

    return result;
  }, [agents, searchQuery, selectedFilter]);

  // Convert API agents to the display format for AgentCard
  const displayAgents = filteredAgents.map(formatAgentForDisplay);

  /**
   * Compute aggregate stats for the header.
   * These used to be hardcoded (2 agents, 4.8 avg, 95% success).
   * Now computed from real data.
   */
  const agentCount = agents?.length ?? 0;
  const avgRating =
    agentCount > 0
      ? (agents!.reduce((sum, a) => sum + a.rating, 0) / agentCount).toFixed(1)
      : '0';
  const avgSuccess =
    agentCount > 0
      ? Math.round(
          agents!.reduce((sum, a) => sum + a.successRate, 0) / agentCount,
        )
      : 0;

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

          {/* Stats Row — now uses real computed data instead of hardcoded values */}
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
                {/* REPLACED: was hardcoded `verificationAgents.length` */}
                {agentCount}
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
                  {/* REPLACED: was hardcoded "4.8" */}
                  {avgRating}
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
                {/* REPLACED: was hardcoded "95%" */}
                {avgSuccess}%
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

          {/* Search Bar — now functional (filters agents by name/specialization) */}
          <View className="mt-4">
            <Input
              placeholder="Search by name, specialization..."
              icon={<Search size={20} color={colors.placeholder} />}
              value={searchQuery}
              onChangeText={(text: string) => {
                setSearchQuery(text);
                // Track search queries for analytics (debounced in the Input)
                if (text.length >= 3) {
                  analyticsService.trackSearch(text, 'agents');
                }
              }}
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

        {/* Results Count — now shows filtered count from real data */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text
            className={cn(
              'font-medium',
              isDark ? 'text-gray-300' : 'text-gray-700',
            )}
          >
            {displayAgents.length} agents found
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

        {/* Agents List — Loading / Empty / Results states */}
        <Section className="pt-0">
          {isLoading ? (
            // Show loading spinner while fetching agents from API
            <View className="items-center py-8">
              <ActivityIndicator color={colors.primary} />
              <Text
                className={cn(
                  'mt-2 text-sm',
                  isDark ? 'text-gray-400' : 'text-gray-500',
                )}
              >
                Loading agents...
              </Text>
            </View>
          ) : displayAgents.length === 0 ? (
            // Empty state when no agents match the search/filter
            <View className="items-center py-8">
              <Users size={40} color={colors.iconMuted} />
              <Text
                className={cn(
                  'mt-2 text-center',
                  isDark ? 'text-gray-400' : 'text-gray-500',
                )}
              >
                No agents found matching your criteria
              </Text>
            </View>
          ) : (
            // Render the filtered agent cards
            displayAgents.map((agent) => (
              <Link key={agent.id} href={`/apply/agents/${agent.id}`} asChild>
                <TouchableOpacity activeOpacity={0.7}>
                  <AgentCard agent={agent} />
                </TouchableOpacity>
              </Link>
            ))
          )}
        </Section>
      </ScrollView>
    </Screen>
  );
}
