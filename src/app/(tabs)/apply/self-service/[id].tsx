import { useLocalSearchParams, router } from 'expo-router';
import { ScrollView, View, TouchableOpacity, Text, Alert } from 'react-native';
import { CheckCircle2, Clock } from 'lucide-react-native';
import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { useVisaTypes } from '@/hooks/useVisaTypes';
import { DocumentPreview } from '@/components/DocumentPreview';
import { ScheduleTimeline } from '@/components/ScheduleTimeline';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Header, Section, Card, ProgressBar, Button } from '@/components/ui/themed';

interface UploadedDocument {
  id: string;
  name: string;
  status: 'uploading' | 'uploaded' | 'error';
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
    status: 'pending' | 'uploaded' | 'verified' | 'rejected';
  }[];
}

export default function SelfServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getVisaType } = useVisaTypes();
  const visa = getVisaType(id);
  const { isDark, colors } = useTheme();
  const [uploadedDocs, setUploadedDocs] = useState<
    Record<string, UploadedDocument[]>
  >({});
  const [selectedDoc, setSelectedDoc] = useState<UploadedDocument | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleItem[]>(() =>
    (visa?.requirements || []).map((req, index) => ({
      id: req.id || `req-${index}`,
      title: req.title,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      completed: false,
      documents: (req.documents || []).map((doc, idx) => ({
        id: `${req.id || `req-${index}`}-doc-${idx}`,
        name: doc,
        status: 'pending' as const,
      })),
    })),
  );

  if (!visa) return null;

  const handleScheduleUpdate = (
    scheduleId: string,
    updates: Partial<ScheduleItem>,
  ) => {
    setSchedules((prev) =>
      prev.map((schedule) =>
        schedule.id === scheduleId ? { ...schedule, ...updates } : schedule,
      ),
    );
  };

  const updateDocumentStatus = (
    scheduleId: string,
    documentId: string,
    status: 'pending' | 'uploaded' | 'verified' | 'rejected',
  ) => {
    setSchedules((prev) =>
      prev.map((schedule) =>
        schedule.id === scheduleId
          ? {
              ...schedule,
              documents: schedule.documents.map((doc) =>
                doc.id === documentId ? { ...doc, status } : doc,
              ),
            }
          : schedule,
      ),
    );
  };

  const handleDocumentUpload = async (requirementId: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const asset = result.assets[0];

        const newDoc: UploadedDocument = {
          id: Date.now().toString(),
          name: asset.name,
          status: 'uploaded',
          uri: asset.uri,
        };

        setUploadedDocs((prev) => ({
          ...prev,
          [requirementId]: [...(prev[requirementId] || []), newDoc],
        }));

        const docId = `${requirementId}-doc-0`;
        updateDocumentStatus(requirementId, docId, 'uploaded');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      Alert.alert('Upload Error', 'There was an error uploading your document');
    }
  };

  const calculateProgress = () => {
    const totalDocs = visa.requirements.reduce(
      (acc, req) => acc + req.documents.length,
      0,
    );
    const uploadedCount = Object.values(uploadedDocs).reduce(
      (acc, docs) => acc + docs.length,
      0,
    );
    return Math.round((uploadedCount / totalDocs) * 100);
  };

  return (
    <Screen>
      <ScrollView className="flex-1">
        {/* Header */}
        <View className={cn('px-4 py-4', isDark ? 'bg-gray-800' : 'bg-white')}>
          <Header title="Self-Service Application" showBack />

          {/* Progress Bar */}
          <View className="mt-4">
            <View className="mb-2 flex-row justify-between">
              <Text
                className={cn(
                  'font-medium',
                  isDark ? 'text-white' : 'text-gray-900',
                )}
              >
                Application Progress
              </Text>
              <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                {calculateProgress()}%
              </Text>
            </View>
            <ProgressBar progress={calculateProgress()} />
          </View>
        </View>

        {/* Schedule Timeline */}
        <Section title="Schedule">
          <ScheduleTimeline
            schedules={schedules}
            onScheduleUpdate={handleScheduleUpdate}
          />
        </Section>

        {/* Requirements List */}
        <Section>
          {visa.requirements.map((req) => (
            <Card key={req.id} className="mb-4">
              <View className="mb-3 flex-row items-center justify-between">
                <Text
                  className={cn(
                    'text-lg font-semibold',
                    isDark ? 'text-white' : 'text-gray-900',
                  )}
                >
                  {req.title}
                </Text>
                <View className="flex-row items-center">
                  <Clock size={16} color={colors.iconMuted} />
                  <Text
                    className={cn(
                      'ml-2',
                      isDark ? 'text-gray-400' : 'text-gray-600',
                    )}
                  >
                    {req.estimatedTime}
                  </Text>
                </View>
              </View>

              <Text
                className={cn('mb-4', isDark ? 'text-gray-400' : 'text-gray-600')}
              >
                {req.description}
              </Text>

              {/* Required Documents */}
              <View
                className={cn(
                  'mb-4 rounded-lg p-3',
                  isDark ? 'bg-gray-700' : 'bg-gray-50',
                )}
              >
                <Text
                  className={cn(
                    'mb-2 font-medium',
                    isDark ? 'text-gray-300' : 'text-gray-700',
                  )}
                >
                  Required Documents:
                </Text>
                {req.documents.map((doc, idx) => (
                  <View
                    key={idx}
                    className="flex-row items-center justify-between py-2"
                  >
                    <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                      - {doc}
                    </Text>
                    {uploadedDocs[req.id]?.some((d) => d.name.includes(doc)) ? (
                      <CheckCircle2 size={20} color="#16a34a" />
                    ) : (
                      <Button
                        size="sm"
                        onPress={() => handleDocumentUpload(req.id)}
                      >
                        Upload
                      </Button>
                    )}
                  </View>
                ))}
              </View>

              {/* Uploaded Documents */}
              {uploadedDocs[req.id]?.length > 0 && (
                <View className="mt-2">
                  <Text
                    className={cn(
                      'mb-2 font-medium',
                      isDark ? 'text-gray-300' : 'text-gray-700',
                    )}
                  >
                    Uploaded Documents:
                  </Text>
                  {uploadedDocs[req.id].map((doc) => (
                    <View
                      key={doc.id}
                      className={cn(
                        'flex-row items-center justify-between border-b py-2',
                        isDark ? 'border-gray-700' : 'border-gray-100',
                      )}
                    >
                      <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                        {doc.name}
                      </Text>
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
            </Card>
          ))}
        </Section>
      </ScrollView>

      {selectedDoc && (
        <DocumentPreview
          uri={selectedDoc.uri || ''}
          fileName={selectedDoc.name}
          isVisible={previewVisible}
          onClose={() => {
            setPreviewVisible(false);
            setSelectedDoc(null);
          }}
        />
      )}
    </Screen>
  );
}
