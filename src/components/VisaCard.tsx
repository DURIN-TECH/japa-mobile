import { View, Text, Pressable } from 'react-native';
import { CuratorAvatars } from './CuratorAvatars';

export type VisaInfo = {
  country: string;
  type: string;
  duration: string;
  requirements: string[];
  curators: Array<{
    id: string;
    name: string;
    initials: string;
  }>;
};

export function VisaCard({ visa }: { visa: VisaInfo }) {
  return (
    <Pressable className="mb-4 rounded-xl bg-white p-4 shadow-sm">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-gray-800">{visa.country}</Text>
        <Text className="text-sm font-medium text-blue-600">{visa.type}</Text>
      </View>
      
      <Text className="mb-2 text-sm text-gray-600">
        Duration: {visa.duration}
      </Text>
      
      <View className="mb-3">
        <Text className="mb-1 font-medium text-gray-700">Requirements:</Text>
        {visa.requirements.map((req, index) => (
          <Text key={index} className="text-sm text-gray-600">
            • {req}
          </Text>
        ))}
      </View>

      <View className="mt-2 flex-row items-center justify-between">
        <CuratorAvatars curators={visa.curators} />
        <Text className="text-xs text-gray-500">
          {visa.curators.length} curator{visa.curators.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </Pressable>
  );
}
