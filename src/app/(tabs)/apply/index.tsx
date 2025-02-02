import { ScrollView, View, Text, TextInput, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Calendar, ArrowRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { countryCodeMap, getCountryFlag } from "@/utils/countryFlags";

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
    id: "h1b",
    country: 'United States',
    type: 'H-1B Work Visa',
    duration: '6-8 months',
    price: 460,
    requirements: [
      'Bachelor\'s degree or higher',
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
    id: "f1",
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
        <View className="px-4 py-4 bg-white">
          <Text className="text-2xl font-bold text-gray-950 mb-2">Available Visas</Text>
          
          {/* Search Bar */}
          <View className="flex-row justify-center items-center mt-2">
            <TextInput 
              placeholder="Search visa types..."
              className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <View className="absolute left-3 top-1/2 -translate-y-1/2">
              <Search size={20} color="#9CA3AF" />
            </View>
          </View>
        </View>

        <ScrollView>
          {/* Popular Categories */}
          <View className="px-4 py-4">
            <Text className="font-bold text-lg text-gray-900 mb-3">Popular Categories</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="flex-row gap-3"
            >
              {['Student', 'Tourist', 'Work', 'Business'].map((category) => (
                <TouchableOpacity 
                  key={category}
                  className="px-6 py-3 bg-white rounded-full border border-gray-200"
                >
                  <Text className="font-medium text-gray-800">{category}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Available Visas */}
          <View className="px-4 py-2">
            <View className="flex-row justify-between mb-3">
              <Text className="font-bold text-lg text-gray-900">Curated Visas</Text>
              <TouchableOpacity>
                <Text className="text-md font-medium text-blue-600">
                  View All
                </Text>
              </TouchableOpacity>
            </View>
            
            {SAMPLE_VISAS.map((visa) => (
              <TouchableOpacity 
                key={visa.id}
                onPress={() => router.push({
                  pathname: "/apply/visa-details/[id]",
                  params: { id: visa.id }
                })}
                className="mb-3 p-4 bg-white rounded-xl border border-gray-200"
              >
                {/* Header with Visa Type and Metadata */}
                <View className="flex-row items-center gap-2 mb-4">
                  <View className="flex-row items-center flex-1">
                    <Image
                      source={{ uri: getCountryFlag(countryCodeMap[visa.country]) }}
                      className="w-6 h-6 rounded-full mr-2"
                      resizeMode="cover"
                    />
                    <Text className="text-lg font-bold text-gray-800">{visa.type}</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm text-gray-600">{visa.duration}</Text>
                    <ArrowRight size={20} color="#2563eb" />
                  </View>
                </View>

                {/* Requirements Section */}
                <View className="mb-4 bg-gray-50 p-3 rounded-lg">
                  <Text className="font-medium text-gray-700 mb-2">Requirements</Text>
                  {visa.requirements.map((req, idx) => (
                    <Text key={idx} className="text-sm text-gray-600 mb-1">• {req}</Text>
                  ))}
                </View>

                {/* Curators Section */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="flex-row">
                      {visa.curators.map((curator, idx) => (
                        <View
                          key={curator.id}
                          className="h-8 w-8 rounded-full bg-blue-500 items-center justify-center"
                          style={{ 
                            marginLeft: idx > 0 ? -12 : 0,
                            zIndex: visa.curators.length - idx,
                            borderWidth: 2,
                            borderColor: 'white'
                          }}
                        >
                          <Text className="text-xs font-medium text-white">
                            {curator.initials}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <Text className="text-sm text-gray-600 ml-3">
                      {visa.curators.length} curator{visa.curators.length !== 1 ? 's' : ''}
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