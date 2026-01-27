import { useState, useMemo } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Search, ArrowRight, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { getCountryFlag } from '@/utils/countryFlags';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Section, Input, Chip, Card } from '@/components/ui/themed';
import { useVisaTypes, useVisaSearch } from '@/hooks/useVisaTypes';
import { VisaCategory } from '@/types/visas.type';

const CATEGORIES: { label: string; value: VisaCategory }[] = [
  { label: 'All', value: 'other' }, // 'other' used as placeholder for 'all'
  { label: 'Student', value: 'student' },
  { label: 'Tourist', value: 'tourist' },
  { label: 'Work', value: 'work' },
  { label: 'Business', value: 'business' },
];

export default function Apply() {
  const { isDark, colors } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<VisaCategory | null>(null);

  // Fetch all visa types
  const { data: visaData, isLoading: visasLoading } = useVisaTypes({
    category: selectedCategory ?? undefined,
    limit: 20,
  });

  // Search visa types
  const { data: searchResults, isLoading: searchLoading } = useVisaSearch(searchQuery);

  // Determine which visas to display
  const displayedVisas = useMemo(() => {
    return searchQuery.length >= 2 ? (searchResults ?? []) : (visaData?.visaTypes ?? []);
  }, [searchQuery, searchResults, visaData]);

  const isLoading = searchQuery.length >= 2 ? searchLoading : visasLoading;

  const clearFilters = () => {
    setSelectedCategory(null);
    setSearchQuery('');
  };

  const hasActiveFilters = selectedCategory || searchQuery;

  // TODO: Consider adding "Filter by Country" section for better UX when visa catalog grows
  // Would allow users to filter visas by destination country (e.g., US, UK, Canada)

  return (
    <Screen>
      {/* Header Section */}
      <View className={cn('px-4 py-4', isDark ? 'bg-gray-800' : 'bg-white')}>
        <Text
          className={cn(
            'mb-2 text-2xl font-bold',
            isDark ? 'text-white' : 'text-gray-950',
          )}
        >
          Available Visas
        </Text>

        {/* Search Bar */}
        <View className="mt-2">
          <Input
            placeholder="Search visa types..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            icon={<Search size={20} color={colors.placeholder} />}
          />
        </View>

        {/* Active filters indicator */}
        {hasActiveFilters && (
          <TouchableOpacity
            onPress={clearFilters}
            className="mt-2 flex-row items-center"
          >
            <X size={16} color={colors.primary} />
            <Text className="ml-1 text-sm text-blue-600">Clear filters</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Categories */}
        <Section title="Categories">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row' }}
          >
            {CATEGORIES.map((category, index) => {
              const isSelected =
                (category.value === 'other' && !selectedCategory) ||
                selectedCategory === category.value;
              return (
                <TouchableOpacity
                  key={category.value}
                  onPress={() =>
                    setSelectedCategory(
                      category.value === 'other' ? null : category.value
                    )
                  }
                  style={{ marginRight: index < CATEGORIES.length - 1 ? 12 : 0 }}
                >
                  <Chip variant={isSelected ? 'primary' : 'default'}>
                    {category.label}
                  </Chip>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Section>


        {/* Available Visas */}
        <Section
          title={searchQuery ? 'Search Results' : 'Available Visas'}
          rightElement={
            visaData && visaData.total > 0 ? (
              <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                {visaData.total} visas
              </Text>
            ) : null
          }
        >
          {isLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : displayedVisas.length === 0 ? (
            <Card>
              <View className="items-center py-4">
                <Text className={cn('text-center', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  {searchQuery ? 'No visas found for your search' : 'No visas available'}
                </Text>
              </View>
            </Card>
          ) : (
            displayedVisas.map((visa) => (
              <Card
                key={visa.id}
                onPress={() =>
                  router.push({
                    pathname: '/apply/visa-details/[id]',
                    params: { id: visa.id, countryCode: visa.countryCode },
                  })
                }
                className="mb-3"
              >
                {/* Header with Visa Type and Metadata */}
                <View className="mb-4 flex-row items-center gap-2">
                  <View className="flex-1 flex-row items-center">
                    <Image
                      source={{
                        uri: getCountryFlag(visa.countryCode),
                      }}
                      className="mr-2 h-6 w-6 rounded-full"
                      resizeMode="cover"
                    />
                    <Text
                      className={cn(
                        'flex-1 text-lg font-bold',
                        isDark ? 'text-white' : 'text-gray-800',
                      )}
                      numberOfLines={1}
                    >
                      {visa.name}
                    </Text>
                  </View>
                  <ArrowRight size={20} color={colors.primary} />
                </View>

                {/* Description */}
                <Text
                  className={cn(
                    'mb-4 text-sm',
                    isDark ? 'text-gray-400' : 'text-gray-600',
                  )}
                  numberOfLines={2}
                >
                  {visa.description}
                </Text>

                {/* Eligibility Criteria */}
                {visa.eligibilityCriteria && visa.eligibilityCriteria.length > 0 && (
                  <View
                    className={cn(
                      'mb-4 rounded-lg p-3',
                      isDark ? 'bg-gray-700' : 'bg-gray-50',
                    )}
                  >
                    <Text
                      className={cn(
                        'mb-2 font-medium',
                        isDark ? 'text-gray-300' : 'text-gray-700',
                      )}
                    >
                      Eligibility
                    </Text>
                    {visa.eligibilityCriteria.slice(0, 3).map((criteria, idx) => (
                      <Text
                        key={idx}
                        className={cn(
                          'mb-1 text-sm',
                          isDark ? 'text-gray-400' : 'text-gray-600',
                        )}
                      >
                        - {criteria}
                      </Text>
                    ))}
                    {visa.eligibilityCriteria.length > 3 && (
                      <Text className="mt-1 text-sm text-blue-600">
                        +{visa.eligibilityCriteria.length - 3} more
                      </Text>
                    )}
                  </View>
                )}

                {/* Footer with processing time and price */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      {visa.processingTime}
                    </Text>
                    <Text className={cn('mx-2', isDark ? 'text-gray-600' : 'text-gray-300')}>
                      •
                    </Text>
                    <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      {visa.validityPeriod}
                    </Text>
                  </View>
                  <Text className="font-bold text-blue-600">${visa.baseCostUsd}</Text>
                </View>

                {/* Agents available */}
                {visa.agentIds && visa.agentIds.length > 0 && (
                  <View className="mt-4 flex-row items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
                    <View className="flex-row items-center">
                      <View className="flex-row">
                        {visa.agentIds.slice(0, 3).map((_, idx) => (
                          <View
                            key={idx}
                            className={cn(
                              'h-8 w-8 items-center justify-center rounded-full',
                              isDark ? 'bg-blue-800' : 'bg-blue-500'
                            )}
                            style={{
                              marginLeft: idx > 0 ? -12 : 0,
                              zIndex: 3 - idx,
                              borderWidth: 2,
                              borderColor: isDark ? '#1f2937' : 'white',
                            }}
                          >
                            <Text className="text-xs font-medium text-white">
                              {String.fromCharCode(65 + idx)}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <Text
                        className={cn(
                          'ml-3 text-sm',
                          isDark ? 'text-gray-400' : 'text-gray-600',
                        )}
                      >
                        {visa.agentIds.length} agent{visa.agentIds.length !== 1 ? 's' : ''} available
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => router.push('/apply/agents')}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text className="text-sm font-medium text-blue-600">View</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            ))
          )}
        </Section>
      </ScrollView>
    </Screen>
  );
}
