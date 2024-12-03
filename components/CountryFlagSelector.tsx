import { useState } from "react"
import { TextInput } from "react-native-gesture-handler";
import { Search } from "lucide-react-native";
import { ScrollView } from "react-native"
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";

// Sample country data
const countries = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'IT', name: 'Italy' },
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
  const [searchTerm, setSearchTerm] = useState('')
  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <ThemedView className="mx-auto bg-background p-4 rounded-lg shadow-lg">
      <ThemedView className="relative mb-4 bg-red-700">
        <TextInput
          placeholder="Search countries"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-4 py-2 w-full rounded-full border-gray-300 focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
      </ThemedView>
      <ScrollView>
        <ThemedView className="grid grid-cols-3 gap-4">
          {filteredCountries.map((country) => (
            <ThemedView key={country.code} className="flex flex-col items-center">
              <ThemedView className="w-5 h-5 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 mb-2">
                <img
                  src={`https://flagcdn.com/w160/${country.code.toLowerCase()}.png`}
                  alt={`${country.name} flag`}
                  className="w-full h-full object-cover"
                />
              </ThemedView>
              <ThemedText className="text-sm text-center font-medium text-gray-700">{country.name}</ThemedText>
            </ThemedView>
          ))}
        </ThemedView>
      </ScrollView>
    </ThemedView>
  )
}