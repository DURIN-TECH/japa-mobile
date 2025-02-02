import { useState, useEffect } from "react";
import { Application } from "@/types/applications";

// Mock data - replace with actual API calls
const MOCK_APPLICATIONS: Application[] = [
  {
    id: "app1",
    userId: "user1",
    agentId: "agent1",
    agentName: "Sarah Johnson",
    visaType: "H-1B Work Visa",
    status: "pending",
    progress: 65,
    startDate: "2024-02-01",
    lastUpdated: "2024-02-15",
    currentStep: "Document Verification",
    nextStep: "Embassy Interview",
    documents: {
      required: 8,
      uploaded: 6,
      verified: 5
    },
    timeline: [
      {
        date: "2024-02-01",
        title: "Application Started",
        description: "Initial consultation completed",
        status: "completed"
      },
      {
        date: "2024-02-10",
        title: "Document Collection",
        description: "Uploading required documents",
        status: "current"
      },
      {
        date: "2024-03-01",
        title: "Embassy Interview",
        description: "Scheduled interview date",
        status: "upcoming"
      }
    ]
  },
  {
    id: "app2",
    userId: "user1",
    agentId: "agent2",
    agentName: "Michael Chen",
    visaType: "F-1 Student Visa",
    status: "completed",
    progress: 100,
    startDate: "2024-01-15",
    lastUpdated: "2024-02-20",
    currentStep: "Visa Approved",
    nextStep: null,
    documents: {
      required: 6,
      uploaded: 6,
      verified: 6
    },
    timeline: [
      {
        date: "2024-01-15",
        title: "Application Started",
        description: "Initial consultation completed",
        status: "completed"
      },
      {
        date: "2024-01-25",
        title: "Documents Verified",
        description: "All required documents approved",
        status: "completed"
      },
      {
        date: "2024-02-20",
        title: "Visa Approved",
        description: "Student visa successfully issued",
        status: "completed"
      }
    ]
  }
];

export function useApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    const fetchApplications = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setApplications(MOCK_APPLICATIONS);
      } catch (error) {
        console.error("Error fetching applications:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchApplications();
  }, []);

  return { applications, isLoading };
} 