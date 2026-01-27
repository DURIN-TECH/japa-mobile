import { View, TouchableOpacity, ScrollView, Text } from 'react-native';
import { format, addDays, isSameDay } from 'date-fns';
import { useTheme, cn } from '@/hooks/useTheme';

interface DatePickerProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function DatePicker({ selectedDate, onSelectDate }: DatePickerProps) {
  const { isDark } = useTheme();
  const dates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row">
        {dates.map((date) => {
          const isSelected = isSameDay(date, selectedDate);
          return (
            <TouchableOpacity
              key={date.toISOString()}
              onPress={() => onSelectDate(date)}
              className={cn(
                'mr-2 rounded-xl px-4 py-3',
                isSelected
                  ? 'bg-blue-600'
                  : isDark
                    ? 'border border-gray-700 bg-gray-800'
                    : 'border border-gray-200 bg-white',
              )}
            >
              <Text
                className={cn(
                  'text-center font-medium',
                  isSelected
                    ? 'text-white'
                    : isDark
                      ? 'text-gray-300'
                      : 'text-gray-900',
                )}
              >
                {format(date, 'EEE')}
              </Text>
              <Text
                className={cn(
                  'mt-1 text-center text-lg font-bold',
                  isSelected
                    ? 'text-white'
                    : isDark
                      ? 'text-white'
                      : 'text-gray-900',
                )}
              >
                {format(date, 'd')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}
