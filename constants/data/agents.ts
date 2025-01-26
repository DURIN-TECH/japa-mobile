import { Agent } from "@/types/documents";

export const verificationAgents: Agent[] = [
  {
    id: "agent1",
    name: "Sarah Johnson",
    initials: "SJ",
    rating: 4.8,
    verificationCount: 1234,
    price: 50,
    specializations: ["Student Visa", "Work Visa", "Tourist Visa"],
    availability: true,
    responseTime: "24-48 hours",
    languages: ["English", "Spanish"],
    description: "Expert in US immigration with 10+ years experience",
    consultationFee: 25,
    successRate: 98,
    featuredVisas: ["H1B", "F1", "B1/B2"]
  },
  {
    id: "agent2",
    name: "Michael Chen",
    initials: "MC",
    rating: 4.9,
    verificationCount: 2156,
    price: 65,
    specializations: ["Business Visa", "Investor Visa", "Family Visa"],
    availability: true,
    responseTime: "12-24 hours",
    languages: ["English", "Mandarin", "Cantonese"],
    description: "Specialized in business and investment immigration",
    consultationFee: 30,
    successRate: 95,
    featuredVisas: ["E2", "EB-5", "L1"]
  }
]; 