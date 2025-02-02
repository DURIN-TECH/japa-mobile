import { useLocalSearchParams, router } from "expo-router";
import { ScrollView, View, TouchableOpacity, Text, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Calendar, Upload, CheckCircle2, Clock } from "lucide-react-native";
import { useVisaTypes } from "@/hooks/useVisaTypes";
import { useState } from "react";
import * as DocumentPicker from 'expo-document-picker';
import { DocumentPreview } from "@/components/DocumentPreview";
import { validateDocument } from "@/utils/documentValidation";
import { ScheduleTimeline } from "@/components/ScheduleTimeline";

interface UploadedDocument {
  id: string;
  name: string;
  status: "uploading" | "uploaded" | "error";
  uri?: string;
}

interface ScheduleItem {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  completed: boolean;
  documents: {
    id: string;
    name: string;
    status: "pending" | "uploaded" | "verified" | "rejected";
  }[];
}

export default function SelfServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getVisaType } = useVisaTypes();
  const visa = getVisaType(id);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, UploadedDocument[]>>({});
  const [selectedDoc, setSelectedDoc] = useState<UploadedDocument | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleItem[]>(() => 
    (visa?.requirements || []).map((req, index) => ({
      id: req.id || `req-${index}`,
      title: req.title,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      completed: false,
      documents: (req.documents || []).map((doc, idx) => ({
        id: `${req.id || `req-${index}`}-doc-${idx}`,
        name: doc,
        status: "pending" as const
      }))
    }))
  );
  console.log("visa requirements", visa?.requirements, schedules);

  if (!visa) return null;

  const handleScheduleUpdate = (scheduleId: string, updates: Partial<ScheduleItem>) => {
    console.log({scheduleId, updates});
    setSchedules(prev => prev.map(schedule => 
      schedule.id === scheduleId 
        ? { ...schedule, ...updates }
        : schedule
    ));
  };

  const updateDocumentStatus = (scheduleId: string, documentId: string, status: "pending" | "uploaded" | "verified" | "rejected") => {
    setSchedules(prev => prev.map(schedule => 
      schedule.id === scheduleId ? {
        ...schedule,
        documents: schedule.documents.map(doc =>
          doc.id === documentId ? { ...doc, status } : doc
        )
      } : schedule
    ));
  };

  console.log({id, schedules});

  const handleDocumentUpload = async (requirementId: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        
        // TODO: Investigate why validation is not working nor triggering alert on failure
        // Validate document
        // const validation = await validateDocument(asset.uri, asset.name);
        
        // if (!validation.isValid) {
        //   Alert.alert("Invalid Document", validation.errors.join("\n"));
        //   return;
        // }

        const newDoc: UploadedDocument = {
          id: Date.now().toString(),
          name: asset.name,
          status: "uploaded",
          uri: asset.uri
        };

        setUploadedDocs(prev => ({
          ...prev,
          [requirementId]: [...(prev[requirementId] || []), newDoc]
        }));

        // Update document status in schedule
        const docId = `${requirementId}-doc-0`; // Assuming single document for now
        updateDocumentStatus(requirementId, docId, "uploaded");
      }
    } catch (error) {
      console.error("Error uploading document:", error);
      Alert.alert("Upload Error", "There was an error uploading your document");
    }
  };

  const calculateProgress = () => {
    const totalDocs = visa.requirements.reduce(
      (acc, req) => acc + req.documents.length, 
      0
    );
    const uploadedCount = Object.values(uploadedDocs).reduce(
      (acc, docs) => acc + docs.length, 
      0
    );
    return Math.round((uploadedCount / totalDocs) * 100);
  };

  return (
    <SafeAreaView>
      <ScrollView className="h-screen bg-gray-50">
        {/* Header */}
        <View className="px-4 py-4 bg-white">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="flex-row mb-4 items-center"
          >
            <ChevronLeft size={24} color="#000" />
            <Text className="ml-2 text-lg font-semibold">Self-Service Application</Text>
          </TouchableOpacity>

          {/* Progress Bar */}
          <View className="mt-2">
            <View className="flex-row justify-between mb-2">
              <Text className="font-medium text-gray-900">Application Progress</Text>
              <Text className="text-gray-600">{calculateProgress()}%</Text>
            </View>
            <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <View 
                className="h-full bg-blue-600 rounded-full"
                style={{ width: `${calculateProgress()}%` }}
              />
            </View>
          </View>
        </View>

        {/* Schedule Timeline */}
        <View className="px-4 py-4">
          <Text className="font-bold text-lg text-gray-900 mb-3">Schedule</Text>
          <ScheduleTimeline
            schedules={schedules}
            onScheduleUpdate={handleScheduleUpdate}
          />
        </View>

        {/* Requirements List */}
        <View className="px-4 py-4">
          {visa.requirements.map((req) => (
            <View key={req.id} className="bg-white p-4 rounded-xl border border-gray-200 mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="font-semibold text-lg">{req.title}</Text>
                <View className="flex-row items-center">
                  <Clock size={16} color="#6b7280" />
                  <Text className="ml-2 text-gray-600">{req.estimatedTime}</Text>
                </View>
              </View>
              
              <Text className="text-gray-600 mb-4">{req.description}</Text>

              {/* Required Documents */}
              <View className="bg-gray-50 p-3 rounded-lg mb-4">
                <Text className="font-medium mb-2">Required Documents:</Text>
                {req.documents.map((doc, idx) => (
                  <View key={idx} className="flex-row items-center justify-between py-2">
                    <Text className="text-gray-600">• {doc}</Text>
                    {uploadedDocs[req.id]?.some(d => d.name.includes(doc)) ? (
                      <CheckCircle2 size={20} color="#16a34a" />
                    ) : (
                      <TouchableOpacity 
                        onPress={() => handleDocumentUpload(req.id)}
                        className="bg-blue-600 px-3 py-1 rounded-lg"
                      >
                        <Text className="text-white">Upload</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>

              {/* Uploaded Documents */}
              {uploadedDocs[req.id]?.length > 0 && (
                <View className="mt-2">
                  <Text className="font-medium mb-2">Uploaded Documents:</Text>
                  {uploadedDocs[req.id].map((doc) => (
                    <View 
                      key={doc.id} 
                      className="flex-row items-center justify-between py-2 border-b border-gray-100"
                    >
                      <Text className="text-gray-600">{doc.name}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedDoc(doc);
                          setPreviewVisible(true);
                        }}
                      >
                        <Text className="text-blue-600">View</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {selectedDoc && (
        <DocumentPreview
          uri={selectedDoc.uri || ""}
          fileName={selectedDoc.name}
          isVisible={previewVisible}
          onClose={() => {
            setPreviewVisible(false);
            setSelectedDoc(null);
          }}
        />
      )}
    </SafeAreaView>
  );
} 