import { Application, Consultation } from "@/types";

export const mockApplications: Application[] = [
  {
    id: "app1",
    visaType: "Student Visa (F-1)",
    status: "in_progress",
    submittedDate: new Date("2024-03-01"),
    progress: 65,
  },
  {
    id: "app2",
    visaType: "Work Visa (H-1B)",
    status: "pending",
    submittedDate: new Date("2024-02-28"),
    progress: 30,
  },
];

export const mockConsultations: Consultation[] = [
  {
    id: "cons1",
    type: "Initial Consultation",
    status: "scheduled",
    scheduledDate: new Date("2024-03-15"),
    consultantName: "Sarah Johnson",
  },
  {
    id: "cons2",
    type: "Document Review",
    status: "completed",
    scheduledDate: new Date("2024-02-20"),
    consultantName: "Michael Chen",
  },
]; 