import { View, TouchableOpacity, ScrollView, Text } from "react-native";
import { format, addDays, isSameDay } from "date-fns";

interface DatePickerProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function DatePicker({ selectedDate, onSelectDate }: DatePickerProps) {
  // Generate next 14 days
  const dates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
    >
      <View className="flex-row">
        {dates.map((date) => (
          <TouchableOpacity
            key={date.toISOString()}
            onPress={() => onSelectDate(date)}
            className={`
              mr-2 px-4 py-3 rounded-xl
              ${isSameDay(date, selectedDate) 
                ? 'bg-blue-600' 
                : 'bg-white border border-gray-200'
              }
            `}
          >
            <Text 
              className={`
                text-center font-medium
                ${isSameDay(date, selectedDate) ? 'text-white' : 'text-gray-900'}
              `}
            >
              {format(date, 'EEE')}
            </Text>
            <Text 
              className={`
                text-center text-lg font-bold mt-1
                ${isSameDay(date, selectedDate) ? 'text-white' : 'text-gray-900'}
              `}
            >
              {format(date, 'd')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}