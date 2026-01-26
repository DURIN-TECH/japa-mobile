import { useLocalSearchParams, router } from 'expo-router';
import {
  ScrollView,
  View,
  TouchableOpacity,
  Text,
  Alert,
  Linking,
} from 'react-native';
import { Calendar, Video, MessageSquare } from 'lucide-react-native';
import { format } from 'date-fns';
import { useConsultations } from '@/hooks/useConsultations';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Header, Section, Card, Button } from '@/components/ui/themed';

export default function ConsultationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { consultations } = useConsultations();
  const consultation = consultations.find((c) => c.id === id);
  const { isDark, colors } = useTheme();

  if (!consultation) {
    return (
      <Screen>
        <Header title="Consultation" showBack />
        <View className="flex-1 items-center justify-center">
          <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            Consultation not found
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Consultation Details" showBack />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Consultation Info */}
        <Section>
          <Card>
            <View className="mb-4 flex-row items-center">
              <Calendar size={20} color={colors.primary} />
              <View className="ml-2">
                <Text
                  className={cn(
                    'font-semibold',
                    isDark ? 'text-white' : 'text-gray-900',
                  )}
                >
                  {format(new Date(consultation.date), 'EEEE, MMMM d, yyyy')}
                </Text>
                <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  {consultation.time}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <Video size={20} color={colors.primary} />
              <Text
                className={cn(
                  'ml-2',
                  isDark ? 'text-gray-400' : 'text-gray-600',
                )}
              >
                30 Minutes Video Consultation
              </Text>
            </View>
          </Card>
        </Section>

        {/* Agent Info */}
        <Section title="Agent">
          <Card>
            <View className="flex-row items-center justify-between">
              <View>
                <Text
                  className={cn(
                    'text-lg font-semibold',
                    isDark ? 'text-white' : 'text-gray-900',
                  )}
                >
                  {consultation.agentName}
                </Text>
                <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  Visa Consultant
                </Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL(
                    `mailto:support@durintech.com?subject=Consultation with ${consultation.agentName}`,
                  )
                }
                className={cn(
                  'rounded-full p-2',
                  isDark ? 'bg-blue-900/50' : 'bg-blue-50',
                )}
              >
                <MessageSquare size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </Card>
        </Section>

        {/* Actions */}
        {consultation.status === 'upcoming' && (
          <Section>
            <Button
              className="mb-3"
              onPress={() => Linking.openURL('https://meet.google.com')}
            >
              Join Meeting
            </Button>
            <Button
              variant="outline"
              className="mb-3"
              onPress={() =>
                Alert.alert(
                  'Reschedule',
                  'Contact support to reschedule your consultation.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Contact Support',
                      onPress: () =>
                        Linking.openURL('mailto:support@durintech.com'),
                    },
                  ],
                )
              }
            >
              Reschedule
            </Button>
            <TouchableOpacity
              className="mt-3"
              onPress={() =>
                Alert.alert(
                  'Cancel Consultation',
                  'Are you sure you want to cancel this consultation?',
                  [
                    { text: 'No', style: 'cancel' },
                    {
                      text: 'Yes, Cancel',
                      style: 'destructive',
                      onPress: () => router.back(),
                    },
                  ],
                )
              }
            >
              <Text className="text-center font-semibold text-red-600">
                Cancel Consultation
              </Text>
            </TouchableOpacity>
          </Section>
        )}

        {/* Summary (for completed consultations) */}
        {consultation.status === 'completed' && consultation.summary && (
          <Section title="Summary">
            <Card>
              <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                {consultation.summary}
              </Text>
            </Card>
          </Section>
        )}
      </ScrollView>
    </Screen>
  );
}
