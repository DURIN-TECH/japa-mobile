/**
 * Consultation Detail Screen
 *
 * Shows full details for a single consultation including date/time,
 * agent info, and action buttons (Join, Reschedule, Cancel).
 *
 * INTEGRATION CHANGE: Previously found the consultation from the mock
 * array by ID. Now fetches from GET /consultations/:id via useConsultation().
 * Cancel action now calls PUT /consultations/:id/status via useCancelConsultation().
 *
 * Backend endpoints:
 * - GET /consultations/:id — fetch detail
 * - PUT /consultations/:id/status — cancel consultation
 */

import { useLocalSearchParams, router } from 'expo-router';
import {
  ScrollView,
  View,
  TouchableOpacity,
  Text,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Calendar, Video, MessageSquare } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import {
  useConsultation,
  useCancelConsultation,
  getConsultationDisplayStatus,
  getConsultationTypeLabel,
} from '@/hooks/useConsultations';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Header, Section, Card, Button } from '@/components/ui/themed';

export default function ConsultationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDark, colors } = useTheme();

  // Fetch single consultation from API (replaces array.find from mock)
  const { data: consultation, isLoading } = useConsultation(id);
  // Mutation for cancelling the consultation
  const cancelMutation = useCancelConsultation();

  // Loading state
  if (isLoading) {
    return (
      <Screen>
        <Header title="Consultation" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  // Not found state
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

  // Map to simplified display status for action visibility
  const displayStatus = getConsultationDisplayStatus(consultation.status);
  const typeLabel = getConsultationTypeLabel(consultation.type);

  // Format date from ISO string
  let formattedDate = consultation.scheduledDate;
  try {
    formattedDate = format(
      parseISO(consultation.scheduledDate),
      'EEEE, MMMM d, yyyy',
    );
  } catch {
    // Keep raw date if parsing fails
  }

  /**
   * Handle consultation cancellation.
   * Shows a confirmation alert, then calls the cancel mutation.
   * On success, navigates back to the consultations list.
   */
  const handleCancel = () => {
    Alert.alert(
      'Cancel Consultation',
      'Are you sure you want to cancel this consultation?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelMutation.mutateAsync(consultation.id);
              router.back();
            } catch {
              Alert.alert(
                'Error',
                'Failed to cancel consultation. Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Header title="Consultation Details" showBack />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Consultation Info — date, time, type, duration */}
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
                  {formattedDate}
                </Text>
                <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  {consultation.scheduledTime}
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
                {consultation.durationMinutes} Minutes {typeLabel}
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

        {/* Actions — only shown for upcoming consultations */}
        {displayStatus === 'upcoming' && (
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
            {/* Cancel button — now wired to PUT /consultations/:id/status */}
            <TouchableOpacity className="mt-3" onPress={handleCancel}>
              <Text className="text-center font-semibold text-red-600">
                {cancelMutation.isPending
                  ? 'Cancelling...'
                  : 'Cancel Consultation'}
              </Text>
            </TouchableOpacity>
          </Section>
        )}

        {/* Notes (if any) */}
        {consultation.notes && (
          <Section title="Notes">
            <Card>
              <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                {consultation.notes}
              </Text>
            </Card>
          </Section>
        )}

        {/* Summary (for completed consultations) */}
        {displayStatus === 'completed' && consultation.summary && (
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
