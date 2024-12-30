import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { verificationAgents } from "@/constants/data/documents";
import { ScrollView, TouchableOpacity } from "react-native";
import { Link } from "expo-router";

export default function SelectAgent() {
  return (
    <ScrollView>
      <ThemedView>
        <ThemedText type="title">Select Verification Agent</ThemedText>
        <ThemedText className="mb-4">
          Choose an agent to verify your documents
        </ThemedText>

        {verificationAgents.map((agent) => (
          <ThemedView 
            key={agent.id}
            className="border border-gray-200 rounded-lg p-4 mb-3"
          >
            <ThemedText type="subtitle">{agent.name}</ThemedText>
            <ThemedText>⭐️ {agent.rating} ({agent.verificationCount} verifications)</ThemedText>
            <ThemedText>Specializes in: {agent.specializations.join(", ")}</ThemedText>
            <ThemedText className="text-green-600 font-bold">${agent.price}</ThemedText>
            
            <Link 
              href={{
                pathname: "/documents/payment",
                params: { agentId: agent.id }
              }}
              asChild
            >
              <TouchableOpacity className="bg-blue-500 p-3 rounded-lg mt-3">
                <ThemedText className="text-white text-center">
                  Select & Continue to Payment
                </ThemedText>
              </TouchableOpacity>
            </Link>
          </ThemedView>
        ))}
      </ThemedView>
    </ScrollView>
  );
} 