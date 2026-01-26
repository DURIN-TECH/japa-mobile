import { View, Text, TouchableOpacity } from 'react-native';
import { Calendar, Clock, CheckCircle2 } from 'lucide-react-native';
import { useState } from 'react';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { ScheduleItem } from '@/types/documents.type';
import { useTheme, cn } from '@/hooks/useTheme';

interface ScheduleTimelineProps {
  schedules: ScheduleItem[];
  onScheduleUpdate: (
    scheduleId: string,
    updates: Partial<ScheduleItem>,
  ) => void;
}

export function ScheduleTimeline({
  schedules,
  onScheduleUpdate,
}: Readonly<ScheduleTimelineProps>) {
  const [selectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeSchedule, setActiveSchedule] = useState<string | null>(null);
  const [dateType, setDateType] = useState<'start' | 'end'>('start');
  const { isDark, colors } = useTheme();

  const handleDateSelect = (event: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(false);
    if (date && activeSchedule) {
      onScheduleUpdate(activeSchedule, {
        [dateType === 'start' ? 'startDate' : 'endDate']: date,
      });
    }
  };

  schedules = [
    {
      id: '1',
      title: 'Canada Visa Application',
      startDate: new Date(),
      endDate: new Date(),
      completed: false,
      documents: [],
    },
  ];

  console.log({ schedules });

  const getDocStatusStyles = (status: string) => {
    if (isDark) {
      switch (status) {
        case 'verified':
          return { bg: 'bg-green-900/50', text: 'text-green-300' };
        case 'rejected':
          return { bg: 'bg-red-900/50', text: 'text-red-300' };
        case 'uploaded':
          return { bg: 'bg-blue-900/50', text: 'text-blue-300' };
        default:
          return { bg: 'bg-gray-700', text: 'text-gray-300' };
      }
    } else {
      switch (status) {
        case 'verified':
          return { bg: 'bg-green-100', text: 'text-green-700' };
        case 'rejected':
          return { bg: 'bg-red-100', text: 'text-red-700' };
        case 'uploaded':
          return { bg: 'bg-blue-100', text: 'text-blue-700' };
        default:
          return { bg: 'bg-gray-100', text: 'text-gray-700' };
      }
    }
  };

  return (
    <View
      className={cn(
        'rounded-xl border',
        isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white',
      )}
    >
      {schedules.map((schedule, index) => (
        <View
          key={schedule.id}
          className={cn(
            'p-4',
            index !== schedules.length - 1 &&
              (isDark
                ? 'border-b border-gray-700'
                : 'border-b border-gray-200'),
          )}
        >
          {/* Schedule Header */}
          <View className="mb-3 flex-row items-start justify-between">
            <View className="flex-1">
              <Text
                className={cn(
                  'text-lg font-semibold',
                  isDark ? 'text-white' : 'text-gray-900',
                )}
              >
                {schedule.title}
              </Text>
              <View className="mt-2 flex-row items-center">
                <Calendar size={16} color={colors.iconMuted} />
                <Text
                  className={cn(
                    'ml-2',
                    isDark ? 'text-gray-400' : 'text-gray-600',
                  )}
                >
                  {schedule.startDate.toLocaleDateString()} -{' '}
                  {schedule.endDate.toLocaleDateString()}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() =>
                onScheduleUpdate(schedule.id, {
                  completed: !schedule.completed,
                })
              }
              className={cn(
                'rounded-full p-2',
                schedule.completed
                  ? isDark
                    ? 'bg-green-900/50'
                    : 'bg-green-100'
                  : isDark
                    ? 'bg-gray-700'
                    : 'bg-gray-100',
              )}
            >
              <CheckCircle2
                size={20}
                color={schedule.completed ? '#16a34a' : colors.iconMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Document Status - Only show if there are documents */}
          {schedule.documents.length > 0 && (
            <View
              className={cn(
                'mb-3 rounded-lg p-3',
                isDark ? 'bg-gray-700' : 'bg-gray-50',
              )}
            >
              {schedule.documents.map((doc) => {
                const statusStyles = getDocStatusStyles(doc.status);
                return (
                  <View
                    key={doc.id}
                    className="flex-row items-center justify-between py-2"
                  >
                    <Text
                      className={isDark ? 'text-gray-400' : 'text-gray-600'}
                    >
                      {doc.name}
                    </Text>
                    <View
                      className={cn('rounded-full px-2 py-1', statusStyles.bg)}
                    >
                      <Text
                        className={cn('text-xs font-medium', statusStyles.text)}
                      >
                        {doc.status.charAt(0).toUpperCase() +
                          doc.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Date Picker Actions */}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => {
                setDateType('start');
                setActiveSchedule(schedule.id);
                setShowDatePicker(true);
              }}
              className={cn(
                'flex-1 flex-row items-center justify-center rounded-lg p-2',
                isDark ? 'bg-blue-900/50' : 'bg-blue-50',
              )}
            >
              <Clock size={16} color={colors.primary} />
              <Text
                className={cn(
                  'ml-2 font-medium',
                  isDark ? 'text-blue-300' : 'text-blue-700',
                )}
              >
                Update Start
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setDateType('end');
                setActiveSchedule(schedule.id);
                setShowDatePicker(true);
              }}
              className={cn(
                'flex-1 flex-row items-center justify-center rounded-lg p-2',
                isDark ? 'bg-blue-900/50' : 'bg-blue-50',
              )}
            >
              <Clock size={16} color={colors.primary} />
              <Text
                className={cn(
                  'ml-2 font-medium',
                  isDark ? 'text-blue-300' : 'text-blue-700',
                )}
              >
                Update End
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          onChange={handleDateSelect}
        />
      )}
    </View>
  );
}
