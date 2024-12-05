import { useState } from "react"
import { TextInput } from "react-native-gesture-handler";
import { Search } from "lucide-react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { ScrollView, View, Image } from "react-native";

// Sample visa data
const visaTypes = [
  { code: 'US', name: 'H-1B Visa' },
  { code: 'GB', name: 'B-2 Visa' },
  { code: 'FR', name: 'H-2A Visa' },
  { code: 'IT', name: 'H-2B Visa' },
]

export default function VisaTypeSelector() {
  const [searchTerm, setSearchTerm] = useState("");
  const filteredVisas = visaTypes.filter(visaType =>
    visaType.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <View>
      <View className="p-4 bg-transparent">
        <View className="relative">
          <TextInput
            placeholder="Search Visas"
            value={searchTerm}
            onChangeText={setSearchTerm}
            className="pl-10 pr-4 py-2 rounded-full border text-gray-400 border-gray-200"
          />
          <Search className="absolute left-3 top-2 text-gray-400" size={20} />
        </View>
      </View>

      <ThemedText className="ml-4 mb-4 font-extrabold">Select Visa</ThemedText>
      
      <ScrollView contentContainerClassName="p-1">
        <View>
          <View className="flex-row flex-wrap gap-4 justify-evenly">
            {filteredVisas.map((visa) => (
              <View key={visa.code} className="items-center w-[40%]">
                <View className="w-40 h-40 rounded-lg overflow-hidden mb-2">
                  <Image
                    source={{ uri: `https://flagcdn.com/w160/${visa.code.toLowerCase()}.png` }}
                    className="w-full h-full"
                  />
                </View>
                <ThemedText className="text-center text-sm">{visa.name}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}