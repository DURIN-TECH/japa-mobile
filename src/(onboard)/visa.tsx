import { useState } from 'react';
import { Search } from 'lucide-react-native';
import { ScrollView, View, Image, TextInput } from 'react-native';
import { Link } from 'expo-router';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useOnboarding } from '@/context/OnboardingContext';
// Sample visa data
import { visaTypes } from '@/mock_data/visas';

export default function VisaTypeSelector() {
  const [searchTerm, setSearchTerm] = useState('');
  const { updateOnboardingData } = useOnboarding();

  const filteredVisas = visaTypes.filter((visaType) =>
    visaType.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const selectVisa = (visa: string): void => {
    if (!visa) {
      console.error('No visa provided to selectVisa');
      return;
    }
    updateOnboardingData({
      destinationVisa: visa,
    });
  };

  return (
    <View>
      <View className="bg-transparent p-4">
        <View className="relative">
          <TextInput
            placeholder="Search Visas"
            value={searchTerm}
            onChangeText={setSearchTerm}
            className="rounded-full border border-gray-200 py-2 pl-10 pr-4 text-gray-400"
          />
          <Search className="absolute left-3 top-2 text-gray-400" size={20} />
        </View>
      </View>

      <ThemedView>
        <ThemedText className="mb-4 ml-4 font-extrabold">
          Select Visa
        </ThemedText>

        <ScrollView contentContainerClassName="p-1">
          <View>
            <View className="flex-row flex-wrap justify-evenly gap-4">
              {filteredVisas.map((visa) => (
                <View
                  key={visa.code}
                  className="w-[40%] items-center"
                  onTouchEnd={() => selectVisa(visa.code)}
                >
                  <Link href="/kyc">
                    <View className="mb-2 h-40 w-40 overflow-hidden rounded-lg">
                      <Image
                        source={{
                          uri: `https://flagcdn.com/w160/${visa.img.toLowerCase()}.png`,
                        }}
                        className="h-full w-full"
                      />
                    </View>
                  </Link>
                  <ThemedText className="text-center text-sm">
                    {visa.name}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </ThemedView>
    </View>
  );
}
