import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Screen, Typography, Card, Input } from '@/components/ui/themed';
import { useTheme, cn } from '@/hooks/useTheme';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useCountries } from '@/hooks/useCountries';
import { Country } from '@/types/country.type';
import { Ionicons } from '@expo/vector-icons';

export default function CountrySelectionScreen() {
  const { isDark, colors } = useTheme();
  const setCountry = useOnboardingStore((state) => state.setCountry);
  const { data: countries, isLoading, error } = useCountries(true);
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const filteredCountries = useMemo(() => {
    if (!countries) return [];
    if (!search.trim()) return countries;
    const searchLower = search.toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.code.toLowerCase().includes(searchLower)
    );
  }, [countries, search]);

  const handleSelect = (country: Country) => {
    setSelectedCode(country.code);
  };

  const handleContinue = () => {
    if (selectedCode) {
      setCountry(selectedCode);
      router.push('/(onboard)/personal-info');
    }
  };

  const renderCountryItem = ({ item }: { item: Country }) => {
    const isSelected = selectedCode === item.code;
    return (
      <TouchableOpacity onPress={() => handleSelect(item)}>
        <Card
          className={cn(
            'mb-2 flex-row items-center p-3',
            isSelected && 'border-2 border-blue-500'
          )}
        >
          <Image
            source={{ uri: item.flagUrl }}
            style={{ width: 32, height: 24, borderRadius: 4 }}
            contentFit="cover"
          />
          <Typography variant="body" className="ml-3 flex-1">
            {item.name}
          </Typography>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <Screen>
      <View className="flex-1 px-6 pt-12">
        {/* Progress indicator */}
        <View className="mb-8 flex-row">
          <View className="mr-2 h-1 flex-1 rounded-full bg-blue-500" />
          <View className="mr-2 h-1 flex-1 rounded-full bg-blue-500" />
          <View className={cn('mr-2 h-1 flex-1 rounded-full', isDark ? 'bg-gray-700' : 'bg-gray-200')} />
          <View className={cn('h-1 flex-1 rounded-full', isDark ? 'bg-gray-700' : 'bg-gray-200')} />
        </View>

        {/* Back button */}
        <TouchableOpacity onPress={() => router.back()} className="mb-4">
          <Typography color="primary">← Back</Typography>
        </TouchableOpacity>

        {/* Header */}
        <View className="mb-6">
          <Text className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            Where do you currently live?
          </Text>
          <Typography variant="body" color="muted" className="mt-2">
            Select your country of residence
          </Typography>
        </View>

        {/* Search */}
        <Input
          placeholder="Search countries..."
          value={search}
          onChangeText={setSearch}
          className="mb-4"
        />

        {/* Country list */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
            <Typography color="muted" className="mt-2">Loading countries...</Typography>
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="alert-circle" size={48} color={colors.error} />
            <Typography color="error" className="mt-2">Failed to load countries</Typography>
          </View>
        ) : (
          <FlatList
            data={filteredCountries}
            renderItem={renderCountryItem}
            keyExtractor={(item) => item.code}
            showsVerticalScrollIndicator={false}
            className="flex-1"
            ListEmptyComponent={
              <View className="items-center py-8">
                <Typography color="muted">No countries found</Typography>
              </View>
            }
          />
        )}

        {/* Continue button */}
        <View className="pb-8 pt-4">
          <TouchableOpacity
            onPress={handleContinue}
            disabled={!selectedCode}
            className={cn(
              'items-center rounded-xl py-4',
              selectedCode ? 'bg-blue-500' : isDark ? 'bg-gray-700' : 'bg-gray-300'
            )}
          >
            <Text className={cn('font-semibold', selectedCode ? 'text-white' : 'text-gray-500')}>
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
}
