// hooks/useDashboardData.ts
import { useState, useEffect } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

interface TicketingFunnel {
  total_queries: number;
  total_tickets_created: number;
  total_tickets_resolved: number;
  tickets_created_per_day: Record<string, number>;
  tickets_resolved_per_day: Record<string, number>;
}

export interface DashboardData {
  total_queries: number;
  live_ongoing_conversations: number;
  first_contact_resolution_percentage: number;  
  abandoned_conversations: number;
  ticketing_funnel: TicketingFunnel;
}

export function useDashboardData(org_id: string, timeframe: string) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const queryParams = `org_id=${org_id}&period=${timeframe}`;
        // You can also handle a default range here if timeframe is not provided.
        const res = await serviceDeskInstance.get(`/analytics/cva_dashboard?${queryParams}`);
        setData(res.data.data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    if (org_id) {
      fetchDashboardData();
    }
  }, [org_id, timeframe]);

  return { data, loading, error };
}
