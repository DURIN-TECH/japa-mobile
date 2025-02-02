import { Application, Consultation } from "@/types";

export const mockApplications: Partial<Application>[] = [
  {
    id: "app1",
    visaType: "Student Visa (F-1)",
    status: "pending",
    startDate: new Date("2024-03-01"),
    progress: 65,
  },
  {
    id: "app2",
    visaType: "Work Visa (H-1B)",
    status: "pending",
    startDate: new Date("2024-02-28"),
    progress: 30,
  },
];

export const mockConsultations: Partial<Consultation>[] = [
  {
    id: "cons1",
    type: "Initial Consultation",
    status: "upcoming",
    date: new Date("2024-03-15"),
    agentName: "Sarah Johnson",
  },
  {
    id: "cons2",
    type: "Document Review",
    status: "completed",
    date: new Date("2024-02-20"),
    agentName: "Michael Chen",
  },
]; 