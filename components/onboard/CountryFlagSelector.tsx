import { useState } from "react"
import { TextInput } from "react-native-gesture-handler";
import { Search } from "lucide-react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { ScrollView, View, Image } from "react-native";
import { Link } from "expo-router";

// Sample country data
const supportedCountries = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'IT', name: 'Italy' },
]

const upcomingCountries = [
  { code: 'ES', name: 'Spain' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'RU', name: 'Russia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'EG', name: 'Egypt' },
  { code: 'AR', name: 'Argentina' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
]

export default function CountryFlagSelector() {
  const [searchTerm, setSearchTerm] = useState("");
  const filteredCountries = supportedCountries.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <View>
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

      <ThemedText className="ml-4 font-extrabold">Select Your Preferred Country</ThemedText>
      
      <ScrollView contentContainerClassName="p-1">
        <View>
          <View>
            <ThemedText className="ml-5 my-5">Supported Country</ThemedText>
            <View className="flex-row flex-wrap gap-4 justify-evenly">
              {filteredCountries.map((country) => (
                <View key={country.code} className="items-center w-[15%]">
                    {/* <Link> */}
                      <View className="w-10 h-10 rounded-lg overflow-hidden mb-2">
                        <Image
                          source={{ uri: `https://flagcdn.com/w160/${country.code.toLowerCase()}.png` }}
                          className="w-full h-full"
                        />
                      </View>
                      <ThemedText className="text-center text-sm">{country.name}</ThemedText>
                    {/* </Link> */}
                  </View>
              ))}
            </View>
          </View>
          <View>
            <ThemedText className="ml-5 my-5">Coming Soon</ThemedText>
            <View className="flex-row flex-wrap gap-4 justify-evenly">
              {upcomingCountries.map((country) => (
                <View key={country.code} className="items-center w-[15%]">
                  <View className="w-10 h-10 rounded-lg overflow-hidden mb-2">
                    <Image
                      source={{ uri: `https://flagcdn.com/w160/${country.code.toLowerCase()}.png` }}
                      className="w-full h-full"
                    />
                  </View>
                  <ThemedText className="text-center text-sm">{country.name}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}