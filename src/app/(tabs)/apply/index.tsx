import { ScrollView, View, Text, TouchableOpacity, Image } from 'react-native';
import { Search, ArrowRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { countryCodeMap, getCountryFlag } from '@/utils/countryFlags';
import { visas } from '@/mock_data/visas';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Section, Input, Chip, Card } from '@/components/ui/themed';

export default function Apply() {
  const { isDark, colors } = useTheme();

  return (
    <Screen>
      {/* Header Section */}
      <View className={cn('px-4 py-4', isDark ? 'bg-gray-800' : 'bg-white')}>
        <Text
          className={cn(
            'mb-2 text-2xl font-bold',
            isDark ? 'text-white' : 'text-gray-950',
          )}
        >
          Available Visas
        </Text>

        {/* Search Bar */}
        <View className="mt-2">
          <Input
            placeholder="Search visa types..."
            icon={<Search size={20} color={colors.placeholder} />}
          />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Popular Categories */}
        <Section title="Popular Categories">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row' }}
          >
            {['Student', 'Tourist', 'Work', 'Business'].map(
              (category, index) => (
                <View
                  key={category}
                  style={{ marginRight: index < 3 ? 12 : 0 }}
                >
                  <Chip>{category}</Chip>
                </View>
              ),
            )}
          </ScrollView>
        </Section>

        {/* Available Visas */}
        <Section
          title="Curated Visas"
          rightElement={
            <TouchableOpacity onPress={() => router.push('/apply/agents')}>
              <Text className="text-md font-medium text-blue-600">
                View All
              </Text>
            </TouchableOpacity>
          }
        >
          {visas.map((visa) => (
            <Card
              key={visa.id}
              onPress={() =>
                router.push({
                  pathname: '/apply/visa-details/[id]',
                  params: { id: visa.id },
                })
              }
              className="mb-3"
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
                  <Text
                    className={cn(
                      'text-lg font-bold',
                      isDark ? 'text-white' : 'text-gray-800',
                    )}
                  >
                    {visa.name}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                    {visa.processingTime}
                  </Text>
                  <ArrowRight size={20} color={colors.primary} />
                </View>
              </View>

              {/* Requirements Section */}
              <View
                className={cn(
                  'mb-4 rounded-lg p-3',
                  isDark ? 'bg-gray-700' : 'bg-gray-50',
                )}
              >
                <Text
                  className={cn(
                    'mb-2 font-medium',
                    isDark ? 'text-gray-300' : 'text-gray-700',
                  )}
                >
                  Requirements
                </Text>
                {visa.requirements.map((req, idx) => (
                  <Text
                    key={idx}
                    className={cn(
                      'mb-1 text-sm',
                      isDark ? 'text-gray-400' : 'text-gray-600',
                    )}
                  >
                    - {req.title}
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
                          borderColor: isDark ? '#1f2937' : 'white',
                        }}
                      >
                        <Text className="text-xs font-medium text-white">
                          {curator.initials}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text
                    className={cn(
                      'ml-3 text-sm',
                      isDark ? 'text-gray-400' : 'text-gray-600',
                    )}
                  >
                    {visa.curators.length} curator
                    {visa.curators.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Text className="font-bold text-blue-600">${visa.price}</Text>
              </View>
            </Card>
          ))}
        </Section>
      </ScrollView>
    </Screen>
  );
}
