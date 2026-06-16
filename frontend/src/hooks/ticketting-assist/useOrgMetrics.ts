import { useEffect, useState } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface OrgMetrics {
  total_tickets: number;
  resolved: number;
  escalated: number;
  resolution_rate: number;
  average_resolution_time: number;
}

export interface OrgMetricsApiResponse {
  success: boolean;
  message: string;
  data: OrgMetrics;
}

export function useOrgMetrics(org_id: string, timeframe: string) {
  const [data, setData] = useState<OrgMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchOrgMetrics = async () => {
      if (!org_id || !timeframe) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await serviceDeskInstance.get<OrgMetricsApiResponse>(
          `/analytics/v1/tva/org_metrics?org_id=${org_id}&period=${timeframe}`
        );
        setData(response.data.data);
      } catch (err) {
        console.error('Org metrics fetch failed:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrgMetrics();
  }, [org_id, timeframe]);

  return { data, loading, error };
}
