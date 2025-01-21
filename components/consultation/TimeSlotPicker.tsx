import { View, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";

interface TimeSlotPickerProps {
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
  date: Date;
}

export function TimeSlotPicker({ selectedTime, onSelectTime, date }: Readonly<TimeSlotPickerProps>) {
  // Generate time slots from 9 AM to 5 PM
  const timeSlots = Array.from({ length: 17 }, (_, i) => {
    const hour = Math.floor(i / 2) + 9;
    const minute = i % 2 === 0 ? "00" : "30";
    return `${hour.toString().padStart(2, "0")}:${minute}`;
  });

  return (
    <View className="flex-row flex-wrap gap-2">
      {timeSlots.map((time) => (
        <TouchableOpacity
          key={time}
          onPress={() => onSelectTime(time)}
          className={`
            px-4 py-2 rounded-lg
            ${time === selectedTime 
              ? 'bg-blue-600' 
              : 'bg-white border border-gray-200'
            }
          `}
        >
          <ThemedText 
            className={`
              ${time === selectedTime ? 'text-white' : 'text-gray-900'}
            `}
          >
            {time}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </View>
  );
} 