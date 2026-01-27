import { View, TouchableOpacity, Text } from 'react-native';
import { useTheme, cn } from '@/hooks/useTheme';

interface TimeSlotPickerProps {
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
}

export function TimeSlotPicker({
  selectedTime,
  onSelectTime,
}: Readonly<TimeSlotPickerProps>) {
  const { isDark } = useTheme();

  const timeSlots = Array.from({ length: 17 }, (_, i) => {
    const hour = Math.floor(i / 2) + 9;
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  });

  return (
    <View className="flex-row flex-wrap gap-2">
      {timeSlots.map((time) => {
        const isSelected = time === selectedTime;
        return (
          <TouchableOpacity
            key={time}
            onPress={() => onSelectTime(time)}
            className={cn(
              'rounded-lg px-4 py-2',
              isSelected
                ? 'bg-blue-600'
                : isDark
                  ? 'border border-gray-700 bg-gray-800'
                  : 'border border-gray-200 bg-white',
            )}
          >
            <Text
              className={cn(
                isSelected
                  ? 'text-white'
                  : isDark
                    ? 'text-gray-300'
                    : 'text-gray-900',
              )}
            >
              {time}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
