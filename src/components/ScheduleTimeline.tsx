import { View, Text, TouchableOpacity } from "react-native";
import { Calendar, Clock, CheckCircle2 } from "lucide-react-native";
import { useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ScheduleItem } from "@/types/documents";

interface ScheduleTimelineProps {
  schedules: ScheduleItem[];
  onScheduleUpdate: (scheduleId: string, updates: Partial<ScheduleItem>) => void;
}

export function ScheduleTimeline({ schedules, onScheduleUpdate }: Readonly<ScheduleTimelineProps>) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeSchedule, setActiveSchedule] = useState<string | null>(null);
  const [dateType, setDateType] = useState<"start" | "end">("start");

  const handleDateSelect = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date && activeSchedule) {
      onScheduleUpdate(activeSchedule, {
        [dateType === "start" ? "startDate" : "endDate"]: date
      });
    }
  };

  schedules = [{
    id: '1',
    title: 'Canada Visa Application',
    startDate: new Date(),
    endDate: new Date(),
    completed: false,
    documents: []
  }]
  
  console.log({schedules});

  return (
    <View className="bg-white rounded-xl border border-gray-200">
      {schedules.map((schedule, index) => (
        <View 
          key={schedule.id}
          className={`p-4 ${index !== schedules.length - 1 ? "border-b border-gray-200" : ""}`}
        >
          {/* Schedule Header */}
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1">
              <Text className="font-semibold text-gray-900 text-lg">{schedule.title}</Text>
              <View className="flex-row items-center mt-2">
                <Calendar size={16} color="#6b7280" />
                <Text className="ml-2 text-gray-600">
                  {schedule.startDate.toLocaleDateString()} - {schedule.endDate.toLocaleDateString()}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => onScheduleUpdate(schedule.id, { completed: !schedule.completed })}
              className={`p-2 rounded-full ${schedule.completed ? "bg-green-100" : "bg-gray-100"}`}
            >
              <CheckCircle2 
                size={20} 
                color={schedule.completed ? "#16a34a" : "#6b7280"} 
              />
            </TouchableOpacity>
          </View>

          {/* Document Status - Only show if there are documents */}
          {schedule.documents.length > 0 && (
            <View className="bg-gray-50 p-3 rounded-lg mb-3">
              {schedule.documents.map(doc => (
                <View 
                  key={doc.id}
                  className="flex-row justify-between items-center py-2"
                >
                  <Text className="text-gray-600">{doc.name}</Text>
                  <View 
                    className={`px-2 py-1 rounded-full ${
                      doc.status === "verified" ? "bg-green-100" :
                      doc.status === "rejected" ? "bg-red-100" :
                      doc.status === "uploaded" ? "bg-blue-100" :
                      "bg-gray-100"
                    }`}
                  >
                    <Text 
                      className={`text-xs font-medium ${
                        doc.status === "verified" ? "text-green-700" :
                        doc.status === "rejected" ? "text-red-700" :
                        doc.status === "uploaded" ? "text-blue-700" :
                        "text-gray-700"
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
                setDateType("start");
                setActiveSchedule(schedule.id);
                setShowDatePicker(true);
              }}
              className="flex-1 bg-blue-50 p-2 rounded-lg flex-row justify-center items-center"
            >
              <Clock size={16} color="#2563eb" />
              <Text className="ml-2 text-blue-700 font-medium">Update Start</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setDateType("end");
                setActiveSchedule(schedule.id);
                setShowDatePicker(true);
              }}
              className="flex-1 bg-blue-50 p-2 rounded-lg flex-row justify-center items-center"
            >
              <Clock size={16} color="#2563eb" />
              <Text className="ml-2 text-blue-700 font-medium">Update End</Text>
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