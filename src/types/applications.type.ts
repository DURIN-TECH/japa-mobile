export interface Application {
  id: string;
  userId: string;
  agentId: string;
  agentName: string;
  visaType: string;
  status: 'pending' | 'completed' | 'issues' | 'rejected';
  progress: number;
  startDate: Date;
  lastUpdated: Date;
  currentStep: string;
  nextStep: string | null;
  documents: {
    required: number;
    uploaded: number;
    verified: number;
  };
  timeline: {
    date: Date;
    title: string;
    description: string;
    status: 'completed' | 'current' | 'upcoming';
  }[];
}
