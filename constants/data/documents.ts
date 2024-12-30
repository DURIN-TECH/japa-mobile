import { DocumentRequirement } from "@/types/documents";

export const requiredDocuments: DocumentRequirement[] = [
  {
    id: "passport",
    title: "Valid Passport",
    description: "International passport with at least 6 months validity",
    required: true,
    format: ["pdf", "jpg", "png"],
    maxSize: 5
  },
  {
    id: "birth_cert",
    title: "Birth Certificate",
    description: "Original birth certificate or certified copy",
    required: true,
    format: ["pdf", "jpg", "png"],
    maxSize: 5
  },
  {
    id: "degree_cert",
    title: "Educational Certificates",
    description: "University degree and transcripts",
    required: true,
    format: ["pdf"],
    maxSize: 10
  },
  {
    id: "cv",
    title: "Curriculum Vitae",
    description: "Updated CV/Resume with detailed work history",
    required: true,
    format: ["pdf", "doc", "docx"],
    maxSize: 2
  }
];

export const verificationAgents = [
  {
    id: "agent1",
    name: "Sarah Johnson",
    rating: 4.8,
    verificationCount: 1234,
    price: 50,
    specializations: ["Educational Documents", "Identity Documents"],
    availability: true
  },
  {
    id: "agent2",
    name: "Michael Chen",
    rating: 4.9,
    verificationCount: 2156,
    price: 65,
    specializations: ["Legal Documents", "Professional Certificates"],
    availability: true
  }
];