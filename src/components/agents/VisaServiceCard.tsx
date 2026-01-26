import { View, Text, TouchableOpacity } from 'react-native';
import { FileText, ArrowRight } from 'lucide-react-native';
import { Link } from 'expo-router';
import { useTheme, cn } from '@/hooks/useTheme';
import { Card } from '@/components/ui/themed';

interface VisaServiceCardProps {
  visaType: string;
  agentId: string;
}

export function VisaServiceCard({
  visaType,
  agentId,
}: Readonly<VisaServiceCardProps>) {
  const { isDark, colors } = useTheme();

  return (
    <Card className="mb-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <FileText size={20} color={colors.primary} />
          <View className="ml-3">
            <Text
              className={cn(
                'text-lg font-semibold',
                isDark ? 'text-white' : 'text-gray-900',
              )}
            >
              {visaType}
            </Text>
            <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              Full Application Support
            </Text>
          </View>
        </View>
        <Link
          href={`/apply/agents/${encodeURIComponent(
            agentId,
          )}/visa-service/${encodeURIComponent(visaType)}`}
          asChild
        >
          <TouchableOpacity>
            <ArrowRight size={20} color={colors.primary} />
          </TouchableOpacity>
        </Link>
      </View>
    </Card>
  );
}
