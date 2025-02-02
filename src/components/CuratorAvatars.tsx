import { View, Text } from 'react-native';

type Curator = {
  id: string;
  name: string;
  initials: string;
};

export function CuratorAvatars({ curators }: { curators: Curator[] }) {
  return (
    <View className="flex-row">
      {curators.map((curator, index) => (
        <View
          key={curator.id}
          className="h-12 w-12 -mr-2 rounded-full bg-blue-500 items-center justify-center"
          style={{ zIndex: curators.length - index }}>
          <Text className="text-xs font-medium text-white">
            {curator.initials}
          </Text>
        </View>
      ))}
    </View>
  );
}
