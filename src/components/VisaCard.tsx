import { View, Text, Pressable } from 'react-native';
import { CuratorAvatars } from './CuratorAvatars';
import { useTheme, cn } from '@/hooks/useTheme';

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
  const { isDark } = useTheme();

  return (
    <Pressable
      className={cn(
        'mb-4 rounded-xl p-4 shadow-sm',
        isDark ? 'bg-gray-800' : 'bg-white',
      )}
    >
      <View className="mb-3 flex-row items-center justify-between">
        <Text
          className={cn(
            'text-lg font-bold',
            isDark ? 'text-white' : 'text-gray-800',
          )}
        >
          {visa.country}
        </Text>
        <Text
          className={cn(
            'text-sm font-medium',
            isDark ? 'text-blue-400' : 'text-blue-600',
          )}
        >
          {visa.type}
        </Text>
      </View>

      <Text
        className={cn(
          'mb-2 text-sm',
          isDark ? 'text-gray-400' : 'text-gray-600',
        )}
      >
        Duration: {visa.duration}
      </Text>

      <View className="mb-3">
        <Text
          className={cn(
            'mb-1 font-medium',
            isDark ? 'text-gray-300' : 'text-gray-700',
          )}
        >
          Requirements:
        </Text>
        {visa.requirements.map((req, index) => (
          <Text
            key={index}
            className={cn(
              'text-sm',
              isDark ? 'text-gray-400' : 'text-gray-600',
            )}
          >
            • {req}
          </Text>
        ))}
      </View>

      <View className="mt-2 flex-row items-center justify-between">
        <CuratorAvatars curators={visa.curators} />
        <Text
          className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}
        >
          {visa.curators.length} curator{visa.curators.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </Pressable>
  );
}
