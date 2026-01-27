import { useState, useEffect } from 'react';
import { VisaType } from '@/types/visas.type';
import { visas } from '@/mock_data/visas';

export function useVisaTypes() {
  const [visaTypes, setVisaTypes] = useState<VisaType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVisaTypes = async () => {
      try {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setVisaTypes(visas);
      } catch (error) {
        console.error('Error fetching visa types:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVisaTypes();
  }, []);

  const getVisaType = (id: string) => {
    return visas.find((visa) => visa.id === id);
  };

  return { visaTypes, isLoading, getVisaType };
}
