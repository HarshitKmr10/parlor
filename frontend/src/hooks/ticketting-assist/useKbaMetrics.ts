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
}

export function useKbaMetrics(
  org_id: string, 
  timeframe: string, 
  page = 1, 
  page_size = 10, 
  effective = true
) {
  const [data, setData] = useState<KbaMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchKbaMetrics = async () => {
      if (!org_id || !timeframe) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await serviceDeskInstance.get<KbaMetricsApiResponse>(
          `/analytics/v1/tva/kba-metrics?org_id=${org_id}&period=${timeframe}&page=${page}&page_size=${page_size}&effective=${effective}`
        );
        setData(response.data.data);
      } catch (err) {
        console.error('KBA metrics fetch failed:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchKbaMetrics();
  }, [org_id, timeframe, page, page_size, effective]);

  return { data, loading, error };
}
