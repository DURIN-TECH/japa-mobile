import { useState } from "react"
import { Search } from "lucide-react-native";
import { ThemedView } from "@/components/ThemedView";
import { ScrollView, View, Image, TextInput, Text } from "react-native";
import { Link } from "expo-router";

// Sample country data
import { supportedCountries, upcomingCountries } from "@/mock_data/countries";
import { useOnboarding } from "@/context/OnboardingContext";

export default function CountryFlagSelector() {
  const [searchTerm, setSearchTerm] = useState("");
  const { updateOnboardingData } = useOnboarding();

  const selectCountry = (country: string): void => {
    if (!country) {
      console.error("No country provided to selectCountry");
      return;
    }
    updateOnboardingData({
      destinationCountry: country
    });
  }
  
  const filteredCountries = supportedCountries.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <View className="h-screen">
      <View className="p-4 bg-transparent">
        <View className="relative">
          <TextInput
            placeholder="Search countries"
            value={searchTerm}
            onChangeText={setSearchTerm}
            className="pl-10 pr-4 py-2 rounded-full border text-gray-400 border-gray-200"
          />
          <Search className="absolute left-3 top-2 text-gray-400" size={20} />
        </View>
      </View>

      <Text className="ml-4 my-4 font-extrabold">Select Your Preferred Country</Text>
      
      <ScrollView contentContainerClassName="p-1">
        <View>
          <ThemedView>
            <Text className="ml-2">Supported Country</Text>
            <View className="flex-row flex-wrap gap-4 justify-evenly my-5">
              {filteredCountries.map((country) => (
                <View key={country.code}
                  className="items-center w-[15%]"
                  onTouchEnd={() => selectCountry(country.name)}
                >
                  <Link href="/visa">
                    <View className="w-10 h-10 rounded-lg overflow-hidden mb-2">
                      <Image
                        source={{ uri: `https://flagcdn.com/w160/${country.code.toLowerCase()}.png` }}
                        className="w-full h-full"
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
            <View className="flex-row flex-wrap gap-4 justify-evenly my-5">
              {upcomingCountries.map((country) => (
                <View key={country.code} className="items-center w-[15%]">
                  <View className="w-10 h-10 rounded-lg overflow-hidden mb-2">
                    <Image
                      source={{ uri: `https://flagcdn.com/w160/${country.code.toLowerCase()}.png` }}
                      className="w-full h-full"
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