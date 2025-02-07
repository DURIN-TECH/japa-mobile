import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ArrowRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { countryCodeMap, getCountryFlag } from '@/utils/countryFlags';

interface Curator {
  id: string;
  name: string;
  initials: string;
}

interface VisaInfo {
  id: string;
  country: string;
  type: string;
  duration: string;
  requirements: string[];
  curators: Curator[];
  price: number;
}

const SAMPLE_VISAS: VisaInfo[] = [
  {
    id: 'h1b',
    country: 'United States',
    type: 'H-1B Work Visa',
    duration: '6-8 months',
    price: 460,
    requirements: [
      "Bachelor's degree or higher",
      'Job offer from US employer',
      'Specialty occupation position',
      'Prevailing wage requirement',
    ],
    curators: [
      { id: '1', name: 'Sarah Johnson', initials: 'SJ' },
      { id: '2', name: 'Michael Chen', initials: 'MC' },
      { id: '3', name: 'David Kim', initials: 'DK' },
    ],
  },
  {
    id: 'f1',
    country: 'United States',
    type: 'F-1 Student Visa',
    duration: '2-3 months',
    price: 350,
    requirements: [
      'University acceptance letter',
      'Financial documents',
      'SEVIS I-20 form',
      'English proficiency test',
    ],
    curators: [
      { id: '1', name: 'Sarah Johnson', initials: 'SJ' },
      { id: '4', name: 'Emily Wang', initials: 'EW' },
    ],
  },
];

export default function Apply() {
  return (
    <SafeAreaView>
      <View className="flex h-screen bg-gray-50 pb-44">
        {/* Header Section */}
        <View className="bg-white px-4 py-4">
          <Text className="mb-2 text-2xl font-bold text-gray-950">
            Available Visas
          </Text>

          {/* Search Bar */}
          <View className="mt-2 flex-row items-center justify-center">
            <TextInput
              placeholder="Search visa types..."
              className="w-full rounded-full border border-gray-200 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
            <View className="absolute left-3 top-1/2 -translate-y-1/2">
              <Search size={20} color="#9CA3AF" />
            </View>
          </View>
        </View>

        <ScrollView>
          {/* Popular Categories */}
          <View className="px-4 py-4">
            <Text className="mb-3 text-lg font-bold text-gray-900">
              Popular Categories
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="flex-row gap-3"
            >
              {['Student', 'Tourist', 'Work', 'Business'].map((category) => (
                <TouchableOpacity
                  key={category}
                  className="rounded-full border border-gray-200 bg-white px-6 py-3"
                >
                  <Text className="font-medium text-gray-800">{category}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Available Visas */}
          <View className="px-4 py-2">
            <View className="mb-3 flex-row justify-between">
              <Text className="text-lg font-bold text-gray-900">
                Curated Visas
              </Text>
              <TouchableOpacity>
                <Text className="text-md font-medium text-blue-600">
                  View All
                </Text>
              </TouchableOpacity>
            </View>

            {SAMPLE_VISAS.map((visa) => (
              <TouchableOpacity
                key={visa.id}
                onPress={() =>
                  router.push({
                    pathname: '/apply/visa-details/[id]',
                    params: { id: visa.id },
                  })
                }
                className="mb-3 rounded-xl border border-gray-200 bg-white p-4"
              >
                {/* Header with Visa Type and Metadata */}
                <View className="mb-4 flex-row items-center gap-2">
                  <View className="flex-1 flex-row items-center">
                    <Image
                      source={{
                        uri: getCountryFlag(countryCodeMap[visa.country]),
                      }}
                      className="mr-2 h-6 w-6 rounded-full"
                      resizeMode="cover"
                    />
                    <Text className="text-lg font-bold text-gray-800">
                      {visa.type}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm text-gray-600">
                      {visa.duration}
                    </Text>
                    <ArrowRight size={20} color="#2563eb" />
                  </View>
                </View>

                {/* Requirements Section */}
                <View className="mb-4 rounded-lg bg-gray-50 p-3">
                  <Text className="mb-2 font-medium text-gray-700">
                    Requirements
                  </Text>
                  {visa.requirements.map((req, idx) => (
                    <Text key={idx} className="mb-1 text-sm text-gray-600">
                      • {req}
                    </Text>
                  ))}
                </View>

                {/* Curators Section */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="flex-row">
                      {visa.curators.map((curator, idx) => (
                        <View
                          key={curator.id}
                          className="h-8 w-8 items-center justify-center rounded-full bg-blue-500"
                          style={{
                            marginLeft: idx > 0 ? -12 : 0,
                            zIndex: visa.curators.length - idx,
                            borderWidth: 2,
                            borderColor: 'white',
                          }}
                        >
                          <Text className="text-xs font-medium text-white">
                            {curator.initials}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <Text className="ml-3 text-sm text-gray-600">
                      {visa.curators.length} curator
                      {visa.curators.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text className="font-bold text-blue-600">${visa.price}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
