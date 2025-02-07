import { DocumentRequirement, Agent } from '@/types/documents';

export const requiredDocuments: DocumentRequirement[] = [
  {
    id: 'passport',
    title: 'Valid Passport',
    description: 'International passport with at least 6 months validity',
    required: true,
    format: ['pdf', 'jpg', 'png'],
    maxSize: 5,
    validationCriteria: [
      'Must be valid for at least 6 months',
      'All pages must be clearly visible',
      'No physical damage to passport',
    ],
  },
  {
    id: 'birth_cert',
    title: 'Birth Certificate',
    description: 'Original birth certificate or certified copy',
    required: true,
    format: ['pdf', 'jpg', 'png'],
    maxSize: 5,
    validationCriteria: [
      'Must be original or certified copy',
      'All text must be clearly legible',
      'Must include official seal or watermark',
    ],
  },
  {
    id: 'education_certs',
    title: 'Educational Certificates',
    description: 'University degrees and academic transcripts',
    required: true,
    format: ['pdf'],
    maxSize: 10,
    validationCriteria: [
      'Must include degree certificate',
      'Must include academic transcripts',
      'Must be officially translated if not in English',
    ],
  },
];

export const verificationAgents: Agent[] = [
  {
    id: 'agent1',
    name: 'Sarah Johnson',
    rating: 4.8,
    verificationCount: 1234,
    price: 50,
    specializations: ['Educational Documents', 'Identity Documents'],
    availability: true,
    responseTime: '24-48 hours',
    languages: ['English', 'Spanish'],
    consultationFee: 25,
    successRate: 98,
    featuredVisas: ['H1B', 'F1', 'B1/B2'],
    description: 'Expert',
  },
  {
    id: 'agent2',
    name: 'Michael Chen',
    rating: 4.9,
    verificationCount: 2156,
    price: 65,
    specializations: ['Legal Documents', 'Professional Certificates'],
    availability: true,
    responseTime: '12-24 hours',
    languages: ['English', 'Mandarin', 'Cantonese'],
    consultationFee: 25,
    successRate: 98,
    featuredVisas: ['H1B', 'F1', 'B1/B2'],
    description: 'Expert',
  },
];
