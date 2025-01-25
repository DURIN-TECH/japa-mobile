export interface Application {
  id: string;
  userId: string;
  agentId: string;
  agentName: string;
  visaType: string;
  status: "pending" | "completed" | "issues";
  progress: number;
  startDate: string;
  lastUpdated: string;
  currentStep: string;
  nextStep: string | null;
  documents: {
    required: number;
    uploaded: number;
    verified: number;
  };
  timeline: {
    date: string;
    title: string;
    description: string;
    status: "completed" | "current" | "upcoming";
  }[];
} 