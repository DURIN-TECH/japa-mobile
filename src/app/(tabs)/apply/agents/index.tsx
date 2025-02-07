import {
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search } from 'lucide-react-native';
import { Link, router } from 'expo-router';
import { AgentCard } from '@/components/agents/AgentCard';
import { verificationAgents } from '@/mock_data/agents';

export default function AgentsScreen() {
  return (
    <SafeAreaView>
      {/* Header Section */}
      <View className="bg-white px-4 py-4">
        {/* Header */}
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <ChevronLeft size={24} color="#000" />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-gray-950">
              Find Available Agent
            </Text>
            <Text className="text-md text-gray-500">
              Expert visa consultants at your service
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View className="mt-4 flex-row items-center justify-center">
          <TextInput
            placeholder="Search by name, specialization..."
            className="w-full rounded-full border border-gray-200 py-2 pl-10 pr-4"
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
        {['All', 'Top Rated', 'Student Visa', 'Work Visa', 'Tourist Visa'].map(
          (filter) => (
            <TouchableOpacity
              key={filter}
              className="mr-2 rounded-full border border-gray-200 bg-white px-3 py-1"
            >
              <Text className="text-gray-600">{filter}</Text>
            </TouchableOpacity>
          ),
        )}
      </ScrollView>

      <ScrollView className="h-screen bg-gray-50 pb-44">
        {/* Agents List */}
        <View className="px-4 py-2">
          {verificationAgents.map((agent) => (
            <Link key={agent.id} href={`/apply/agents/${agent.id}`} asChild>
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
