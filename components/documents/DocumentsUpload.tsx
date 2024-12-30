import { useState } from "react";
import { View, TouchableOpacity, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { DocumentRequirement } from "@/types/documents";

interface Props {
  requirement: DocumentRequirement;
  onUpload: (file: DocumentPicker.DocumentPickerResult) => void;
}

export function DocumentUpload({ requirement, onUpload }: Props) {
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: requirement.format.map(format => `application/${format}`),
        copyToCacheDirectory: true,
      });

      if (result.type === "success") {
        // Check file size
        const fileSize = result.size / (1024 * 1024); // Convert to MB
        if (fileSize > requirement.maxSize) {
          setError(`File size exceeds ${requirement.maxSize}MB limit`);
          return;
        }

        onUpload(result);
        setError(null);
      }
    } catch (err) {
      setError("Error uploading document. Please try again.");
    }
  };

  return (
    <ThemedView>
      <TouchableOpacity 
        onPress={handleUpload}
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 items-center"
      >
        <ThemedText>Tap to upload {requirement.title}</ThemedText>
        <ThemedText className="text-sm text-gray-500 mt-2">
          Maximum size: {requirement.maxSize}MB
        </ThemedText>
      </TouchableOpacity>
      
      {error && (
        <ThemedText className="text-red-500 mt-2">{error}</ThemedText>
      )}
    </ThemedView>
  );
}
