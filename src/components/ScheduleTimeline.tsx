import { View, Text, TouchableOpacity } from 'react-native';
import { Calendar, Clock, CheckCircle2 } from 'lucide-react-native';
import { useState } from 'react';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { ScheduleItem } from '@/types/documents.type';

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

  return (
    <View className="rounded-xl border border-gray-200 bg-white">
      {schedules.map((schedule, index) => (
        <View
          key={schedule.id}
          className={`p-4 ${
            index !== schedules.length - 1 ? 'border-b border-gray-200' : ''
          }`}
        >
          {/* Schedule Header */}
          <View className="mb-3 flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-900">
                {schedule.title}
              </Text>
              <View className="mt-2 flex-row items-center">
                <Calendar size={16} color="#6b7280" />
                <Text className="ml-2 text-gray-600">
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
              className={`rounded-full p-2 ${
                schedule.completed ? 'bg-green-100' : 'bg-gray-100'
              }`}
            >
              <CheckCircle2
                size={20}
                color={schedule.completed ? '#16a34a' : '#6b7280'}
              />
            </TouchableOpacity>
          </View>

          {/* Document Status - Only show if there are documents */}
          {schedule.documents.length > 0 && (
            <View className="mb-3 rounded-lg bg-gray-50 p-3">
              {schedule.documents.map((doc) => (
                <View
                  key={doc.id}
                  className="flex-row items-center justify-between py-2"
                >
                  <Text className="text-gray-600">{doc.name}</Text>
                  <View
                    className={`rounded-full px-2 py-1 ${
                      doc.status === 'verified'
                        ? 'bg-green-100'
                        : doc.status === 'rejected'
                          ? 'bg-red-100'
                          : doc.status === 'uploaded'
                            ? 'bg-blue-100'
                            : 'bg-gray-100'
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        doc.status === 'verified'
                          ? 'text-green-700'
                          : doc.status === 'rejected'
                            ? 'text-red-700'
                            : doc.status === 'uploaded'
                              ? 'text-blue-700'
                              : 'text-gray-700'
                      }`}
                    >
                      {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                    </Text>
                  </View>
                </View>
              ))}
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
              className="flex-1 flex-row items-center justify-center rounded-lg bg-blue-50 p-2"
            >
              <Clock size={16} color="#2563eb" />
              <Text className="ml-2 font-medium text-blue-700">
                Update Start
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setDateType('end');
                setActiveSchedule(schedule.id);
                setShowDatePicker(true);
              }}
              className="flex-1 flex-row items-center justify-center rounded-lg bg-blue-50 p-2"
            >
              <Clock size={16} color="#2563eb" />
              <Text className="ml-2 font-medium text-blue-700">Update End</Text>
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
