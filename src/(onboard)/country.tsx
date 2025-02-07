import { useState } from 'react';
import { Search } from 'lucide-react-native';
import { ScrollView, View, Image, TextInput, Text } from 'react-native';
import { Link, RelativePathString } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';

// Sample country data
import { supportedCountries, upcomingCountries } from '@/mock_data/countries';
import { useOnboarding } from '@/context/OnboardingContext';

export default function CountryFlagSelector() {
  const [searchTerm, setSearchTerm] = useState('');
  const { updateOnboardingData } = useOnboarding();

  const selectCountry = (country: string): void => {
    if (!country) {
      console.error('No country provided to selectCountry');
      return;
    }
    if (updateOnboardingData) {
      updateOnboardingData({
        destinationCountry: country,
      });
    }
  };

  const filteredCountries = supportedCountries.filter((country) =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <View className="h-screen">
      <View className="bg-transparent p-4">
        <View className="relative">
          <TextInput
            placeholder="Search countries"
            value={searchTerm}
            onChangeText={setSearchTerm}
            className="rounded-full border border-gray-200 py-2 pl-10 pr-4 text-gray-400"
          />
          <Search className="absolute left-3 top-2 text-gray-400" size={20} />
        </View>
      </View>

      <Text className="my-4 ml-4 font-extrabold">
        Select Your Preferred Country
      </Text>

      <ScrollView contentContainerClassName="p-1">
        <View>
          <ThemedView>
            <Text className="ml-2">Supported Country</Text>
            <View className="my-5 flex-row flex-wrap justify-evenly gap-4">
              {filteredCountries.map((country) => (
                <View
                  key={country.code}
                  className="w-[15%] items-center"
                  onTouchEnd={() => selectCountry(country.name)}
                >
                  <Link
                    href={{
                      pathname: '/(onboard)/visa' as RelativePathString,
                      params: {
                        country: country.name,
                      },
                    }}
                    asChild
                  >
                    <View className="mb-2 h-10 w-10 overflow-hidden rounded-lg">
                      <Image
                        source={{
                          uri: `https://flagcdn.com/w160/${country.code.toLowerCase()}.png`,
                        }}
                        className="h-full w-full"
                      />
                    </View>
                    <Text className="text-center text-sm">{country.name}</Text>
                  </Link>
                </View>
              ))}
            </View>
          </ThemedView>

          <ThemedView>
            <Text className="ml-2">Coming Soon</Text>
            <View className="my-5 flex-row flex-wrap justify-evenly gap-4">
              {upcomingCountries.map((country) => (
                <View key={country.code} className="w-[15%] items-center">
                  <View className="mb-2 h-10 w-10 overflow-hidden rounded-lg">
                    <Image
                      source={{
                        uri: `https://flagcdn.com/w160/${country.code.toLowerCase()}.png`,
                      }}
                      className="h-full w-full"
                    />
                  </View>
                  <Text className="text-center text-sm">{country.name}</Text>
                </View>
              ))}
            </View>
          </ThemedView>
        </View>
      </ScrollView>
    </View>
  );
}
