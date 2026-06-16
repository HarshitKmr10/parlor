import { useEffect, useState } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface TicketMetrics {
  total_tickets: number;
  resolved_tickets: number;
  escalated_tickets: number;
}

export interface TicketMetricsApiResponse {
  success: boolean;
  message: string;
  data: TicketMetrics;
}

export function useTicketMetrics(org_id: string, timeframe: string) {
  const [data, setData] = useState<TicketMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchTicketMetrics = async () => {
      if (!org_id || !timeframe) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await serviceDeskInstance.get<TicketMetricsApiResponse>(
          `/analytics/v1/tva/ticket-metrics?org_id=${org_id}&period=${timeframe}`
        );
        setData(response.data.data);
      } catch (err) {
        console.error('Ticket metrics fetch failed:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTicketMetrics();
  }, [org_id, timeframe]);

  return { data, loading, error };
}
