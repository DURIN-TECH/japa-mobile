import { View, TouchableOpacity, Text } from 'react-native';

interface TimeSlotPickerProps {
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
}

export function TimeSlotPicker({
  selectedTime,
  onSelectTime,
}: Readonly<TimeSlotPickerProps>) {
  // Generate time slots from 9 AM to 5 PM
  const timeSlots = Array.from({ length: 17 }, (_, i) => {
    const hour = Math.floor(i / 2) + 9;
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  });

  return (
    <View className="flex-row flex-wrap gap-2">
      {timeSlots.map((time) => (
        <TouchableOpacity
          key={time}
          onPress={() => onSelectTime(time)}
          className={`rounded-lg px-4 py-2 ${
            time === selectedTime
              ? 'bg-blue-600'
              : 'border border-gray-200 bg-white'
          } `}
        >
          <Text
            className={` ${
              time === selectedTime ? 'text-white' : 'text-gray-900'
            } `}
          >
            {time}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
