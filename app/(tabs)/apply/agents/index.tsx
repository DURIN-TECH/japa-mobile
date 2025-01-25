import { ScrollView, View, TextInput, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search, Star } from 'lucide-react-native';
import { Link, router } from 'expo-router';
import { AgentCard } from '@/components/agents/AgentCard';
import { verificationAgents } from '@/constants/data/agents';

export default function AgentsScreen() {
  return (
    <SafeAreaView>
      {/* Header Section */}
      <View className="bg-white px-4 py-4">
        {/* Header */}
        <View className="flex-row items-center">
          <TouchableOpacity 
              onPress={() => router.back()}
              className="mb-4"
            >
            <ChevronLeft size={24} color="#000" />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-gray-950">Find Available Agent</Text>
            <Text className="text-md text-gray-500">Expert visa consultants at your service</Text>
          </View>
        </View>
        
        {/* Search Bar */}
        <View className="flex-row justify-center items-center mt-4">
          <TextInput 
            placeholder="Search by name, specialization..."
            className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-200"
          />
          <View className="absolute left-3 top-1/2 -translate-y-1/2">
            <Search size={20} color="#9CA3AF" />
          </View>
        </View>
      </View>

      {/* Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="px-4 py-2"
      >
        {['All', 'Top Rated', 'Student Visa', 'Work Visa', 'Tourist Visa'].map((filter) => (
          <TouchableOpacity 
            key={filter}
            className="px-3 py-1 bg-white rounded-full border border-gray-200 mr-2"
          >
            <Text className="text-gray-600">{filter}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView className="h-screen bg-gray-50 pb-44">
        {/* Agents List */}
        <View className="px-4 py-2">
          {verificationAgents.map((agent) => (
            <Link 
              key={agent.id}
              href={`/apply/agents/${agent.id}`}
              asChild
            >
              <TouchableOpacity>
                <AgentCard agent={agent} />
              </TouchableOpacity>
            </Link>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  link: {
    paddingTop: 20,
    fontSize: 20,
    backgroundColor: 'red',
    width: 100,
  },
});