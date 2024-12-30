import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { requiredDocuments } from "@/constants/data/documents";
import { Link } from "expo-router";
import { ScrollView, View } from "react-native";
import { IconSymbol } from "@/components/ui/IconSymbol";

export default function DocumentsList() {
  return (
    <ScrollView>
      <ThemedView>
        <ThemedText type="title">Required Documents</ThemedText>
        <ThemedText>Please upload the following documents for verification</ThemedText>
        
        {requiredDocuments.map((doc) => (
          <Link 
            key={doc.id} 
            href={`/documents/upload/${doc.id}`}
            asChild
          >
            <ThemedView className="flex-row items-center justify-between p-4 border border-gray-200 rounded-lg mb-3">
              <View className="flex-1">
                <ThemedText type="subtitle">{doc.title}</ThemedText>
                <ThemedText>{doc.description}</ThemedText>
                <ThemedText className="text-sm text-gray-500">
                  Accepted formats: {doc.format.join(", ")} (Max: {doc.maxSize}MB)
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={24} color="#666" />
            </ThemedView>
          </Link>
        ))}
      </ThemedView>
    </ScrollView>
  );
}
