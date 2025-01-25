export interface Consultation {
  id: string;
  userId: string;
  agentId: string;
  agentName: string;
  status: "upcoming" | "completed" | "cancelled";
  date: string;
  time: string;
  notes?: string;
  summary?: string;
} 