import { useState } from "react"
import { TextInput } from "react-native-gesture-handler";
import { Search } from "lucide-react-native";
import { ScrollView, View, Image } from "react-native";
import { Link } from "expo-router";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useOnboarding } from "@/context/OnboardingContext";
import { setOnboardingStatus } from "@/utils/storage.service";
// Sample visa data
import { visaTypes } from "@/constants/data/visas";

export default function VisaTypeSelector() {
  const [searchTerm, setSearchTerm] = useState("");
  const filteredVisas = visaTypes.filter(visaType =>
    visaType.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { updateOnboardingData } = useOnboarding();

  const selectVisa = (visa: string): void => {
    if (!visa) {
      console.error("No visa provided to selectVisa");
      return;
    }
    updateOnboardingData({
      destinationVisa: visa
    });
    updateOnboardingStatusStorage(new Date(Date.now()));
  }

  const updateOnboardingStatusStorage = async (timestamp: Date): Promise<void> => {
    await setOnboardingStatus(JSON.stringify(timestamp));
  }

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

      <ThemedView>
        <ThemedText className="ml-4 mb-4 font-extrabold">Select Visa</ThemedText>
        
        <ScrollView contentContainerClassName="p-1">
          <View>
            <View className="flex-row flex-wrap gap-4 justify-evenly">
              {filteredVisas.map((visa) => (
                <View key={visa.code} className="items-center w-[40%]" onTouchEnd={() => selectVisa(visa.code)}>
                  <Link href="/(tabs)">
                    <View className="w-40 h-40 rounded-lg overflow-hidden mb-2">
                      <Image
                        source={{ uri: `https://flagcdn.com/w160/${visa.img.toLowerCase()}.png` }}
                        className="w-full h-full"
                      />
                    </View>
                  </Link>
                  <ThemedText className="text-center text-sm">{visa.name}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </ThemedView>
    </View>
  );
}
