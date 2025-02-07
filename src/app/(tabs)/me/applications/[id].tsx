import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View, TouchableOpacity, Text } from 'react-native';
import { Clock } from 'lucide-react-native';
import { format } from 'date-fns';
import { useApplications } from '@/hooks/useApplications';

export default function ApplicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { applications } = useApplications();
  const application = applications.find((app) => app.id === id);

  if (!application) return null;

  const getStatusColor = (status: 'completed' | 'current' | 'upcoming') => {
    switch (status) {
      case 'completed':
        return '#16a34a';
      case 'current':
        return '#2563eb';
      case 'upcoming':
        return '#6b7280';
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Current Status */}
      <View className="px-4 py-4">
        <View className="rounded-xl border border-gray-200 bg-white p-4">
          <View className="mb-3 flex-row items-center">
            <Clock size={20} color="#2563eb" />
            <View className="ml-2">
              <Text className="font-semibold">{application.currentStep}</Text>
              {application.nextStep && (
                <Text className="text-gray-600">
                  Next: {application.nextStep}
                </Text>
              )}
            </View>
          </View>

          {/* Progress Bar */}
          <View className="mb-3 h-2 overflow-hidden rounded-full bg-gray-100">
            <View
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${application.progress}%` }}
            />
          </View>

          <Text className="text-gray-600">
            Last updated:{' '}
            {format(new Date(application.lastUpdated), 'MMM d, yyyy')}
          </Text>
        </View>
      </View>

      {/* Document Status */}
      <View className="px-4 py-4">
        <Text className="mb-3 text-xl font-bold">Documents</Text>
        <View className="rounded-xl border border-gray-200 bg-white p-4">
          <View className="mb-3 flex-row justify-between">
            <View>
              <Text className="font-semibold">Required</Text>
              <Text className="text-2xl font-bold">
                {application.documents.required}
              </Text>
            </View>
            <View>
              <Text className="font-semibold">Uploaded</Text>
              <Text className="text-2xl font-bold text-blue-600">
                {application.documents.uploaded}
              </Text>
            </View>
            <View>
              <Text className="font-semibold">Verified</Text>
              <Text className="text-2xl font-bold text-green-600">
                {application.documents.verified}
              </Text>
            </View>
          </View>

          <TouchableOpacity className="rounded-lg bg-blue-600 p-3">
            <Text className="text-center font-semibold text-white">
              Manage Documents
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Timeline */}
      <View className="px-4 py-4">
        <Text className="mb-3 text-xl font-bold">Timeline</Text>
        <View className="rounded-xl border border-gray-200 bg-white p-4">
          {application.timeline.map((event, index) => (
            <View
              key={index}
              className={`flex-row items-start pb-4 ${
                index !== application.timeline.length - 1
                  ? 'mb-4 border-b border-gray-100'
                  : ''
              } `}
            >
              <View
                className="mr-3 mt-1.5 h-3 w-3 rounded-full"
                style={{ backgroundColor: getStatusColor(event.status) }}
              />
              <View className="flex-1">
                <Text className="font-semibold">{event.title}</Text>
                <Text className="mt-1 text-gray-600">{event.description}</Text>
                <Text className="mt-1 text-sm text-gray-500">
                  {format(new Date(event.date), 'MMM d, yyyy')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
