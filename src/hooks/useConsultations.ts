import { useState, useEffect } from 'react';
import { Consultation } from '@/types/consultations.type';

const MOCK_CONSULTATIONS: Consultation[] = [
  {
    id: 'cons1',
    userId: 'user1',
    agentId: 'agent1',
    agentName: 'Sarah Johnson',
    status: 'upcoming',
    date: new Date('2024-03-15'),
    time: '10:30',
    type: 'in-person',
  },
  {
    id: 'cons2',
    userId: 'user1',
    agentId: 'agent2',
    agentName: 'Michael Chen',
    status: 'completed',
    date: new Date('2024-02-20'),
    time: '14:00',
    summary: 'Discussed visa requirements and next steps',
    type: 'in-person',
  },
];

export function useConsultations() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConsultations = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setConsultations(MOCK_CONSULTATIONS);
      } catch (error) {
        console.error('Error fetching consultations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConsultations();
  }, []);

  return { consultations, isLoading };
}
