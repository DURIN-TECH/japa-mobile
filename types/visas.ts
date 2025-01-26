export interface VisaType {
  id: string;
  name: string;
  description: string;
  requirements: {
    id: string;
    title: string;
    description: string;
    estimatedTime: string;
    documents: string[];
  }[];
  agents: string[];
  processingTime: string;
  price: number;
  country: string;
}

export interface VisaApplication {
  id: string;
  visaTypeId: string;
  userId: string;
  mode: "self" | "agent";
  agentId?: string;
  status: "pending" | "in_progress" | "completed" | "rejected";
  progress: number;
  schedule: {
    requirementId: string;
    startDate: string;
    endDate: string;
    completed: boolean;
    documents: {
      id: string;
      name: string;
      status: "pending" | "uploaded" | "verified" | "rejected";
      url?: string;
    }[];
  }[];
  startDate: string;
  lastUpdated: string;
} 