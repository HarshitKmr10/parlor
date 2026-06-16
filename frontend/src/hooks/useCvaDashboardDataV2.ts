import { useEffect, useState } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface TicketingFunnelV2 {
  total_queries: number;
  issues: number;
  tickets: number;
}

export interface CvaDashboardDataV2 {
  total_issues: number;
  total_users: number;
  live_conversations: number;
  issue_resolution_rate: number;
  ticketing_funnel: TicketingFunnelV2;
}

export interface CvaDashboardApiResponse {
  success: boolean;
  message: string;
  data: CvaDashboardDataV2;
  total_count: number | null;
}

export function useCvaDashboardDataV2(org_id: string, timeframe: string) {
  const [data, setData] = useState<CvaDashboardDataV2 | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!org_id || !timeframe) return;

      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          org_id,
          period: timeframe,
        }).toString();

        const response: {data: CvaDashboardApiResponse} = await serviceDeskInstance.get(`/analytics/v2/cva/dashboard?${queryParams}`);
        setData(response?.data?.data);
      } catch (err) {
        console.error('Dashboard data fetch failed:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [org_id, timeframe]);

  return { data, loading, error };
}