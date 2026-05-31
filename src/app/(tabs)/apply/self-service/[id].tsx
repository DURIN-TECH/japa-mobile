import { useLocalSearchParams, router } from 'expo-router';
import { ScrollView, View, TouchableOpacity, Text, Alert, ActivityIndicator, Linking } from 'react-native';
import { CheckCircle2, Clock, AlertCircle, Upload, Trash2, RefreshCw, ExternalLink, FileText } from 'lucide-react-native';
import { useState, useCallback } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { useApplication, useApplicationTimeline, getApplicationStatusInfo } from '@/hooks/useApplications';
import { useVisaType } from '@/hooks/useVisaTypes';
import {
  useApplicationDocuments,
  useGetUploadUrl,
  useCreateDocument,
  useDeleteDocument,
  uploadToStorage,
  getDocumentStatusInfo,
} from '@/hooks/useDocuments';
import { DocumentPreview } from '@/components/DocumentPreview';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Header, Section, Card, ProgressBar, Button } from '@/components/ui/themed';
import { Document } from '@/types/documents.type';

interface LocalUploadState {
  requirementId: string;
  fileName: string;
  uri: string;
  status: 'uploading' | 'error';
  error?: string;
}

export default function SelfServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: application, isLoading, error, refetch: refetchApplication } = useApplication(id ?? '');
  const { data: timeline } = useApplicationTimeline(id ?? '');
  const { data: documents, refetch: refetchDocuments } = useApplicationDocuments(id ?? '');
  const { isDark, colors } = useTheme();

  // Fetch visa details for requirements
  const { data: visaData, isLoading: visaLoading } = useVisaType(
    application?.countryCode ?? '',
    application?.visaTypeId ?? ''
  );

  // Upload mutations
  const getUploadUrl = useGetUploadUrl();
  const createDocument = useCreateDocument();
  const deleteDocument = useDeleteDocument();

  // Local state for uploads in progress
  const [uploading, setUploading] = useState<LocalUploadState[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const handleDocumentUpload = useCallback(async (requirementId: string) => {
    if (!application) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const contentType = asset.mimeType || 'application/octet-stream';

      // Add to local uploading state
      const localUpload: LocalUploadState = {
        requirementId,
        fileName: asset.name,
        uri: asset.uri,
        status: 'uploading',
      };
      setUploading((prev) => [...prev, localUpload]);

      try {
        // Step 1: Get signed upload URL
        const uploadUrlResponse = await getUploadUrl.mutateAsync({
          applicationId: application.id,
          fileName: asset.name,
          contentType,
        });

        if (!uploadUrlResponse) {
          throw new Error('Failed to get upload URL');
        }

        // Step 2: Upload file to Firebase Storage
        await uploadToStorage(uploadUrlResponse.uploadUrl, {
          uri: asset.uri,
          type: contentType,
          name: asset.name,
        });

        // Step 3: Register document in backend
        const fileSizeBytes = asset.size || 0;
        const fileSizeMb = fileSizeBytes / (1024 * 1024);

        await createDocument.mutateAsync({
          applicationId: application.id,
          requirementId,
          fileName: asset.name,
          fileType: contentType,
          fileSizeMb,
          storagePath: uploadUrlResponse.storagePath,
        });

        // Remove from local uploading state
        setUploading((prev) =>
          prev.filter((u) => !(u.requirementId === requirementId && u.fileName === asset.name))
        );

        // Refetch documents and application
        refetchDocuments();
        refetchApplication();
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        // Update local state to show error
        setUploading((prev) =>
          prev.map((u) =>
            u.requirementId === requirementId && u.fileName === asset.name
              ? { ...u, status: 'error', error: 'Upload failed' }
              : u
          )
        );
      }
    } catch (err) {
      console.error('Error picking document:', err);
      Alert.alert('Error', 'There was an error selecting your document');
    }
  }, [application, getUploadUrl, createDocument, refetchDocuments, refetchApplication]);

  const handleDeleteDocument = useCallback(async (document: Document) => {
    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${document.fileName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDocument.mutateAsync({
                documentId: document.id,
                applicationId: document.applicationId,
              });
              refetchDocuments();
              refetchApplication();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete document');
            }
          },
        },
      ]
    );
  }, [deleteDocument, refetchDocuments, refetchApplication]);

  const clearUploadError = useCallback((requirementId: string, fileName: string) => {
    setUploading((prev) =>
      prev.filter((u) => !(u.requirementId === requirementId && u.fileName === fileName))
    );
  }, []);

  // Group documents by requirement
  const documentsByRequirement = (documents ?? []).reduce((acc, doc) => {
    if (!acc[doc.requirementId]) {
      acc[doc.requirementId] = [];
    }
    acc[doc.requirementId].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  if (isLoading) {
    return (
      <Screen>
        <Header title="Self-Service Application" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} size="large" />
          <Text className={cn('mt-4', isDark ? 'text-gray-400' : 'text-gray-600')}>
            Loading application...
          </Text>
        </View>
      </Screen>
    );
  }

  if (error || !application) {
    return (
      <Screen>
        <Header title="Application" showBack />
        <View className="flex-1 items-center justify-center px-4">
          <AlertCircle size={48} color={isDark ? '#ef4444' : '#dc2626'} />
          <Text className={cn('mt-4 text-center', isDark ? 'text-gray-400' : 'text-gray-600')}>
            {error ? 'Failed to load application' : 'Application not found'}
          </Text>
          <Button variant="outline" onPress={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </View>
      </Screen>
    );
  }

  const statusInfo = getApplicationStatusInfo(application.status);
  const requirements = visaData?.requirements ?? [];

  return (
    <Screen>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header with Status */}
        <View className={cn('px-4 py-4', isDark ? 'bg-gray-800' : 'bg-white')}>
          <Header title="Self-Service Application" showBack />

          {/* Status Badge */}
          <View className="mt-2 flex-row items-center justify-between">
            <View
              className={cn(
                'rounded-full px-3 py-1',
                isDark ? statusInfo.darkBgColor : statusInfo.bgColor,
              )}
            >
              <Text
                className={cn(
                  'text-sm font-medium',
                  isDark ? statusInfo.darkColor : statusInfo.color,
                )}
              >
                {statusInfo.label}
              </Text>
            </View>
            <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
              {application.currentStep}
            </Text>
          </View>

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
                {application.progress}%
              </Text>
            </View>
            <ProgressBar progress={application.progress} />
          </View>

          {/* Document Summary */}
          <View className="mt-4 flex-row justify-between">
            <View className="items-center">
              <Text className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                {application.documentsUploaded}
              </Text>
              <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>
                Uploaded
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">
                {application.documentsVerified}
              </Text>
              <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>
                Verified
              </Text>
            </View>
            <View className="items-center">
              <Text className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                {application.documentsRequired}
              </Text>
              <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>
                Required
              </Text>
            </View>
            {application.documentsRejected > 0 && (
              <View className="items-center">
                <Text className="text-2xl font-bold text-red-600">
                  {application.documentsRejected}
                </Text>
                <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Rejected
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Timeline Preview */}
        {timeline && timeline.length > 0 && (
          <Section title="Current Status">
            <Card>
              {timeline
                .filter((event) => event.status === 'current' || event.status === 'completed')
                .slice(0, 3)
                .map((event, index, arr) => (
                  <View
                    key={event.id}
                    className={cn(
                      'flex-row items-start',
                      index < arr.length - 1 && 'mb-3 pb-3 border-b',
                      isDark ? 'border-gray-700' : 'border-gray-100',
                    )}
                  >
                    <View
                      className={cn(
                        'mr-3 mt-1 h-2.5 w-2.5 rounded-full',
                        event.status === 'completed' ? 'bg-green-500' : 'bg-blue-500',
                      )}
                    />
                    <View className="flex-1">
                      <Text
                        className={cn(
                          'font-medium',
                          isDark ? 'text-white' : 'text-gray-900',
                        )}
                      >
                        {event.title}
                      </Text>
                      <Text
                        className={cn(
                          'text-sm',
                          isDark ? 'text-gray-400' : 'text-gray-600',
                        )}
                      >
                        {event.description}
                      </Text>
                    </View>
                  </View>
                ))}
              <TouchableOpacity
                onPress={() => router.push(`/me/applications/${application.id}`)}
                className="mt-3"
              >
                <Text className="text-center text-blue-600">View Full Timeline</Text>
              </TouchableOpacity>
            </Card>
          </Section>
        )}

        {/* Official Application Link */}
        {visaData?.visaType.applicationUrl && (
          <Section title="Step 1: Complete Official Application">
            <Card className={isDark ? 'bg-amber-900/30 border-amber-700' : 'bg-amber-50 border-amber-200'}>
              <View className="flex-row items-start">
                <View
                  className={cn(
                    'mr-3 h-10 w-10 items-center justify-center rounded-full',
                    isDark ? 'bg-amber-800' : 'bg-amber-100',
                  )}
                >
                  <FileText size={20} color={isDark ? '#fcd34d' : '#b45309'} />
                </View>
                <View className="flex-1">
                  <Text
                    className={cn(
                      'text-lg font-semibold',
                      isDark ? 'text-amber-200' : 'text-amber-900',
                    )}
                  >
                    Complete Online Application
                  </Text>
                  <Text
                    className={cn(
                      'mt-1',
                      isDark ? 'text-amber-300/80' : 'text-amber-800',
                    )}
                  >
                    {visaData.visaType.applicationInstructions ||
                      'Complete your application on the official government portal before uploading documents.'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (visaData?.visaType.applicationUrl) {
                    Linking.openURL(visaData.visaType.applicationUrl);
                  }
                }}
                className={cn(
                  'mt-4 flex-row items-center justify-center rounded-lg py-3',
                  isDark ? 'bg-amber-700' : 'bg-amber-500',
                )}
              >
                <ExternalLink size={18} color="white" />
                <Text className="ml-2 font-semibold text-white">
                  Open Official Application
                </Text>
              </TouchableOpacity>
              <Text
                className={cn(
                  'mt-2 text-center text-xs',
                  isDark ? 'text-amber-400/60' : 'text-amber-700/60',
                )}
              >
                Opens in your browser
              </Text>
            </Card>
          </Section>
        )}

        {/* Requirements List */}
        <Section title={visaData?.visaType.applicationUrl ? 'Step 2: Upload Documents' : 'Required Documents'}>
          {visaLoading ? (
            <Card>
              <View className="items-center py-4">
                <ActivityIndicator color={colors.primary} />
              </View>
            </Card>
          ) : requirements.length === 0 ? (
            <Card>
              <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                No requirements found for this visa type.
              </Text>
            </Card>
          ) : (
            requirements.map((req) => {
              const reqDocuments = documentsByRequirement[req.id] || [];
              const uploadingForReq = uploading.filter((u) => u.requirementId === req.id);

              return (
                <Card key={req.id} className="mb-4">
                  <View className="mb-3 flex-row items-center justify-between">
                    <Text
                      className={cn(
                        'text-lg font-semibold flex-1',
                        isDark ? 'text-white' : 'text-gray-900',
                      )}
                    >
                      {req.title}
                    </Text>
                    <View className="flex-row items-center">
                      <Clock size={16} color={colors.iconMuted} />
                      <Text
                        className={cn(
                          'ml-1 text-sm',
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

                  {/* Required Documents Checklist */}
                  {req.requiredDocuments && req.requiredDocuments.length > 0 && (
                    <View
                      className={cn(
                        'rounded-lg p-3 mb-3',
                        isDark ? 'bg-gray-700' : 'bg-gray-50',
                      )}
                    >
                      <Text
                        className={cn(
                          'mb-2 text-sm font-medium',
                          isDark ? 'text-gray-300' : 'text-gray-700',
                        )}
                      >
                        Documents needed:
                      </Text>
                      {req.requiredDocuments.map((doc) => {
                        const hasUploaded = reqDocuments.some((d) =>
                          d.fileName.toLowerCase().includes(doc.name.toLowerCase()) ||
                          doc.name.toLowerCase().includes(d.fileName.toLowerCase().split('.')[0])
                        );
                        return (
                          <View
                            key={doc.id}
                            className="flex-row items-center py-1"
                          >
                            {hasUploaded ? (
                              <CheckCircle2 size={16} color="#16a34a" />
                            ) : (
                              <View
                                className={cn(
                                  'h-4 w-4 rounded-full border-2',
                                  isDark ? 'border-gray-500' : 'border-gray-300',
                                )}
                              />
                            )}
                            <Text
                              className={cn(
                                'ml-2 flex-1',
                                isDark ? 'text-gray-300' : 'text-gray-700',
                                hasUploaded && 'line-through opacity-60',
                              )}
                            >
                              {doc.name}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Uploads in Progress */}
                  {uploadingForReq.length > 0 && (
                    <View className="mb-3">
                      {uploadingForReq.map((upload) => (
                        <View
                          key={`${upload.requirementId}-${upload.fileName}`}
                          className={cn(
                            'flex-row items-center justify-between py-2 border-b',
                            isDark ? 'border-gray-700' : 'border-gray-200',
                          )}
                        >
                          <View className="flex-1 flex-row items-center">
                            {upload.status === 'uploading' ? (
                              <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                              <AlertCircle size={16} color="#dc2626" />
                            )}
                            <Text
                              className={cn(
                                'ml-2 flex-1',
                                isDark ? 'text-gray-400' : 'text-gray-600',
                              )}
                              numberOfLines={1}
                            >
                              {upload.fileName}
                            </Text>
                          </View>
                          {upload.status === 'error' && (
                            <TouchableOpacity
                              onPress={() => clearUploadError(upload.requirementId, upload.fileName)}
                              className="ml-2"
                            >
                              <Text className="text-red-500 text-sm">Dismiss</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Uploaded Documents */}
                  {reqDocuments.length > 0 && (
                    <View className="mb-3">
                      <Text
                        className={cn(
                          'mb-2 text-sm font-medium',
                          isDark ? 'text-gray-300' : 'text-gray-700',
                        )}
                      >
                        Uploaded Files:
                      </Text>
                      {reqDocuments.map((doc) => {
                        const docStatusInfo = getDocumentStatusInfo(doc.status);
                        const canDelete = ['uploaded', 'rejected', 'resubmission_required'].includes(doc.status);

                        return (
                          <View
                            key={doc.id}
                            className={cn(
                              'flex-row items-center justify-between py-2 border-b',
                              isDark ? 'border-gray-700' : 'border-gray-200',
                            )}
                          >
                            <View className="flex-1">
                              <Text
                                className={cn(
                                  'font-medium',
                                  isDark ? 'text-gray-300' : 'text-gray-700',
                                )}
                                numberOfLines={1}
                              >
                                {doc.fileName}
                              </Text>
                              <View className="flex-row items-center mt-1">
                                <View
                                  className={cn(
                                    'rounded-full px-2 py-0.5',
                                    isDark ? docStatusInfo.darkBgColor : docStatusInfo.bgColor,
                                  )}
                                >
                                  <Text
                                    className={cn(
                                      'text-xs',
                                      isDark ? docStatusInfo.darkColor : docStatusInfo.color,
                                    )}
                                  >
                                    {docStatusInfo.label}
                                  </Text>
                                </View>
                                {doc.rejectionReason && (
                                  <Text className="ml-2 text-xs text-red-500" numberOfLines={1}>
                                    {doc.rejectionReason}
                                  </Text>
                                )}
                              </View>
                            </View>
                            <View className="flex-row items-center">
                              {canDelete && (
                                <TouchableOpacity
                                  onPress={() => handleDeleteDocument(doc)}
                                  className="p-2"
                                >
                                  <Trash2 size={18} color="#dc2626" />
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Upload Button */}
                  <TouchableOpacity
                    onPress={() => handleDocumentUpload(req.id)}
                    disabled={uploadingForReq.some((u) => u.status === 'uploading')}
                    className={cn(
                      'flex-row items-center justify-center rounded-lg py-3',
                      uploadingForReq.some((u) => u.status === 'uploading')
                        ? 'bg-gray-400'
                        : 'bg-blue-600',
                    )}
                  >
                    {uploadingForReq.some((u) => u.status === 'uploading') ? (
                      <>
                        <ActivityIndicator size="small" color="white" />
                        <Text className="ml-2 font-medium text-white">Uploading...</Text>
                      </>
                    ) : (
                      <>
                        <Upload size={18} color="white" />
                        <Text className="ml-2 font-medium text-white">Upload Document</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </Card>
              );
            })
          )}
        </Section>

        {/* Next Step CTA */}
        {application.nextStep && (
          <Section>
            <Card className={isDark ? 'bg-blue-900/30' : 'bg-blue-50'}>
              <Text
                className={cn(
                  'text-sm font-medium',
                  isDark ? 'text-blue-300' : 'text-blue-800',
                )}
              >
                Next Step
              </Text>
              <Text
                className={cn(
                  'mt-1 text-lg font-semibold',
                  isDark ? 'text-white' : 'text-blue-900',
                )}
              >
                {application.nextStep}
              </Text>
            </Card>
          </Section>
        )}

        {/* Spacer for bottom */}
        <View className="h-24" />
      </ScrollView>

      {selectedDoc && (
        <DocumentPreview
          uri={selectedDoc.storageUrl}
          fileName={selectedDoc.fileName}
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
