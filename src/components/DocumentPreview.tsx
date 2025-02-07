import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  Image,
  ActivityIndicator,
} from 'react-native';
import { X } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import { useState, useEffect } from 'react';
import WebView from 'react-native-webview';

interface DocumentPreviewProps {
  uri: string;
  isVisible: boolean;
  onClose: () => void;
  fileName: string;
}

export function DocumentPreview({
  uri,
  isVisible,
  onClose,
  fileName,
}: DocumentPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [fileInfo, setFileInfo] = useState<FileSystem.FileInfo | null>(null);

  useEffect(() => {
    const getFileInfo = async () => {
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists) {
          setFileInfo(info as FileSystem.FileInfo);
        }
      } catch (error) {
        console.error('Error getting file info:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isVisible) {
      getFileInfo();
    }
  }, [uri, isVisible]);

  const getFileType = () => {
    return fileName.split('.').pop()?.toLowerCase() || '';
  };

  const getFileSizeMB = () => {
    if (!fileInfo || !('size' in fileInfo)) return 0;
    return (fileInfo.size / (1024 * 1024)).toFixed(2);
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-4">
          <Text className="text-lg font-semibold">{fileName}</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : (
          <View className="flex-1">
            {getFileType() === 'pdf' ? (
              <WebView
                source={{ uri }}
                className="flex-1"
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
              />
            ) : (
              <Image source={{ uri }} className="flex-1" resizeMode="contain" />
            )}
          </View>
        )}

        <View className="border-t border-gray-200 px-4 py-4">
          <Text className="text-gray-600">Size: {getFileSizeMB()} MB</Text>
        </View>
      </View>
    </Modal>
  );
}
