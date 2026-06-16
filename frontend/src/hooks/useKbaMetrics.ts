import { useEffect, useState } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface KbaData {
  name: string;
  count: number;
}

export interface KbaMetrics {
  kba_data: KbaData[];
}

export interface KbaMetricsApiResponse {
  success: boolean;
  message: string;
  data: KbaMetrics;
  total_count: number | null;
}

export function useKbaMetrics(org_id: string, timeframe: string) {
  const [data, setData] = useState<KbaMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchKbaMetrics = async () => {
      if (!org_id || !timeframe) return;

      setLoading(true);
      try {
        const response: {data: KbaMetricsApiResponse} = await serviceDeskInstance.get(
          `/analytics/v1/tva/kba-metrics?org_id=${org_id}&period=${timeframe}`
        );
        setData(response?.data?.data);
      } catch (err) {
        console.error('KBA metrics fetch failed:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchKbaMetrics();
  }, [org_id, timeframe]);

  return { data, loading, error };
}
