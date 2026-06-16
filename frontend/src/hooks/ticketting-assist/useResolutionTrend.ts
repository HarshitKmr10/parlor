import { useEffect, useState } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface ResolutionTrendData {
  period: string;
  avg_resolution_time: number;
}

export interface ResolutionTrendApiResponse {
  success: boolean;
  message: string;
  data: ResolutionTrendData[];
}

export function useResolutionTrend(org_id: string, timeframe: string, interval = 'week') {
  const [data, setData] = useState<ResolutionTrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchResolutionTrend = async () => {
      if (!org_id || !timeframe) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await serviceDeskInstance.get<ResolutionTrendApiResponse>(
          `/analytics/v1/tva/resolution-trend?org_id=${org_id}&period=${timeframe}&interval=${interval}`
        );
        setData(response.data.data);
      } catch (err) {
        console.error('Resolution trend fetch failed:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchResolutionTrend();
  }, [org_id, timeframe, interval]);

  return { data, loading, error };
}
