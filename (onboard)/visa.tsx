import { useState } from "react"
import { Search } from "lucide-react-native";
import { ScrollView, View, Image, TextInput } from "react-native";
import { Link } from "expo-router";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useOnboarding } from "@/context/OnboardingContext";
// Sample visa data
import { visaTypes } from "@/constants/data/visas";

export default function VisaTypeSelector() {
  const [searchTerm, setSearchTerm] = useState("");
  const { updateOnboardingData } = useOnboarding();
  
  const filteredVisas = visaTypes.filter(visaType =>
    visaType.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectVisa = (visa: string): void => {
    if (!visa) {
      console.error("No visa provided to selectVisa");
      return;
    }
    updateOnboardingData({
      destinationVisa: visa
    });
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
                  <Link href="/kyc">
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
