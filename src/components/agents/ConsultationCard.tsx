import { View, Text } from 'react-native';
import { Calendar, Clock } from 'lucide-react-native';
import { Link } from 'expo-router';
import { useTheme, cn } from '@/hooks/useTheme';
import { Card, Button } from '@/components/ui/themed';

interface ConsultationCardProps {
  price: number;
  agentId: string;
}

export function ConsultationCard({
  price,
  agentId,
}: Readonly<ConsultationCardProps>) {
  const { isDark, colors } = useTheme();

  return (
    <Card>
      <View className="mb-3 flex-row items-center">
        <Calendar size={20} color={colors.primary} />
        <Text
          className={cn(
            'ml-2 font-semibold',
            isDark ? 'text-white' : 'text-gray-900',
          )}
        >
          30-minute Video Consultation
        </Text>
      </View>

      <View className="mb-4 flex-row items-center">
        <Clock size={16} color={colors.iconMuted} />
        <Text
          className={cn('ml-2', isDark ? 'text-gray-400' : 'text-gray-600')}
        >
          Available within 24 hours
        </Text>
      </View>

      <View
        className={cn(
          'flex-row items-center justify-between border-t pt-3',
          isDark ? 'border-gray-700' : 'border-gray-100',
        )}
      >
        <Text className="font-bold text-green-600">${price}</Text>
        <Link
          href={`/apply/agents/${agentId}/book-consultation?agentId=${agentId}`}
          asChild
        >
          <Button size="sm">Book Now</Button>
        </Link>
      </View>
    </Card>
  );
}
