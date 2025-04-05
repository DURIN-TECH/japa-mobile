import { TouchableOpacity, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Calendar, Award, ArrowRight } from 'lucide-react-native';
import { router } from 'expo-router';

export default function HomeScreen() {
  return (
    <SafeAreaView>
      <View className="flex h-screen bg-gray-50 pb-44">
        {/* Header Section */}
        <View className="bg-white px-4 py-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-2xl font-bold text-gray-950">Japa</Text>
              <Text className="text-md text-gray-500">Welcome back, Alex</Text>
            </View>
            <Bell color="#4b5563" size={24} />
          </View>
        </View>

        <ScrollView>
          {/* Active Applications Summary */}
          <View className="px-4 py-4">
            <View className="rounded-xl bg-blue-50 p-4">
              <Text className="text-lg font-bold text-blue-900">
                Active Applications
              </Text>
              <View className="mt-3 flex flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 space-x-3">
                  <View className="mr-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                    <Calendar color="#2563eb" size={24} />
                  </View>
                  <View>
                    <Text className="text-lg font-semibold">
                      US Tourist Visa
                    </Text>
                    <Text className="text-sm text-gray-600">
                      In Progress • 2 tasks pending
                    </Text>
                  </View>
                </View>
                <ArrowRight className="h-5 w-5 text-blue-600" />
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View className="px-4 py-2">
            <Text className="mb-3 text-lg font-bold text-gray-900">
              Quick Actions
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="flex-row gap-3 overflow-x-auto"
            >
              {[
                {
                  path: '/(tabs)/apply/agents',
                  text: 'Consult Agent',
                  icon: 'Calendar',
                  size: 24,
                  color: '#2563eb',
                },
                {
                  path: '/me/consultations',
                  text: 'Consultations',
                  icon: 'Clock',
                  size: 24,
                  color: '#2563eb',
                },
                {
                  path: '/me/applications',
                  text: 'Applications',
                  icon: 'Calendar',
                  size: 24,
                  color: '#2563eb',
                },
              ].map((actions, index) => (
                <TouchableOpacity
                  key={index}
                  className="flex w-48 items-center justify-center rounded-xl border border-gray-200 bg-white p-4"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onPress={() => router.push(actions.path as any)}
                >
                  <Calendar size={24} color="#2563eb" />
                  <Text className="text-sm font-medium">{actions.text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Featured Agents */}
          <View className="px-4 py-4">
            <View className="mb-3 flex-row justify-between">
              <Text className="text-lg font-bold text-gray-900">
                Top Rated Agents
              </Text>
              <TouchableOpacity onPress={() => router.push('/apply/agents')}>
                <Text className="text-md font-medium text-blue-600">
                  View All
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="flex-row gap-3 overflow-x-auto"
            >
              {[1, 2, 3].map((agent) => (
                <View
                  key={agent}
                  className="w-48 flex-none rounded-xl border border-gray-200 bg-white p-4"
                >
                  <View className="mb-3 flex-row items-center gap-3 space-x-3">
                    <View className="h-10 w-10 rounded-full bg-gray-100" />
                    <View>
                      <Text className="font-medium">Sarah Kim</Text>
                      <Text className="text-sm text-gray-600">
                        US Visa Expert
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-1 space-x-1">
                    <Award size={16} color="#facc15" />
                    <Text className="text-sm font-semibold text-gray-600">
                      4.9 (120 reviews)
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Popular Visas */}
          <View className="px-4 py-2">
            <View className="mb-3 flex-row justify-between">
              <Text className="text-lg font-bold text-gray-900">
                Popular Visas
              </Text>
              <TouchableOpacity>
                <Text className="text-md font-medium text-blue-600">
                  View All
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="flex-row overflow-x-auto pb-4 gap-3"
            >
              {[
                {
                  type: 'Tourist Visa',
                  duration: '6 months',
                  price: '$160',
                  id: 1,
                },
                {
                  type: 'Student Visa',
                  duration: '12 months',
                  price: '$350',
                  id: 2,
                },
                {
                  type: 'Work Visa',
                  duration: '24 months',
                  price: '$460',
                  id: 3,
                },
              ].map((visa) => (
                <TouchableOpacity
                  key={visa.id}
                  className="w-48 flex-none rounded-xl border border-gray-200 bg-white p-4"
                >
                  <View className="flex-row items-center">
                    <View className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
                      <Calendar size={20} color="#2563eb" />
                    </View>
                    <View className="ml-3">
                      <Text className="mb-1 text-lg font-semibold">
                        {visa.type}
                      </Text>
                      <Text className="mb-2 text-gray-600">
                        {visa.duration}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="font-bold text-blue-600">
                      {visa.price}
                    </Text>
                    <ArrowRight size={20} color="#2563eb" />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Popular Destinations */}
          <View className="px-4 py-2">
            <Text className="mb-3 text-lg font-bold text-gray-900">
              Popular Destinations
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {['United States', 'Canada', 'UK', 'Australia'].map((country) => (
                <TouchableOpacity
                  key={country}
                  className="flex-row items-center justify-between rounded-xl border border-gray-200 bg-white p-4"
                  style={{ width: '48%' }}
                >
                  <Text className="font-medium">{country}</Text>
                  <ArrowRight size={20} color="#9ca3af" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
