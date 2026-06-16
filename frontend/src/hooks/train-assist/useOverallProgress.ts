'use client';
import { useState, useEffect } from 'react';

export interface OverallProgressData {
  topicsStarted: number;
  quizzesAttempted: number;
  simulationsDone: number;
}

interface UseOverallProgressProps {
  timePeriod?: string;
  orgId?: string;
}

interface UseOverallProgressReturn {
  data: OverallProgressData | null;
  loading: boolean;
  error: string | null;
}

export const useOverallProgress = ({
  timePeriod = '30 days',
  orgId,
}: UseOverallProgressProps = {}): UseOverallProgressReturn => {
  const [data, setData] = useState<OverallProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // TODO: Replace with actual API call when endpoints are provided
        await new Promise(resolve => setTimeout(resolve, 800));

        const mockData: OverallProgressData = {
          topicsStarted: 400,
          quizzesAttempted: 120,
          simulationsDone: 50,
        };

        setData(mockData);
      } catch (err) {
        console.error('Error fetching overall progress:', err);
        setError('Failed to load overall progress data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timePeriod, orgId]);

  return {
    data,
    loading,
    error,
  };
}; 