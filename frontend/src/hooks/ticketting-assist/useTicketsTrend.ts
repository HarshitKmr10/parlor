import { useEffect, useState } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface TicketsTrendData {
  period: string;
  ticket_count: number;
}

export interface TicketsTrendApiResponse {
  success: boolean;
  message: string;
  data: TicketsTrendData[];
}

export function useTicketsTrend(org_id: string, timeframe: string, interval = 'week') {
  const [data, setData] = useState<TicketsTrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchTicketsTrend = async () => {
      if (!org_id || !timeframe) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await serviceDeskInstance.get<TicketsTrendApiResponse>(
          `/analytics/v1/tva/tickets-trend?org_id=${org_id}&period=${timeframe}&interval=${interval}`
        );
        setData(response.data.data);
      } catch (err) {
        console.error('Tickets trend fetch failed:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTicketsTrend();
  }, [org_id, timeframe, interval]);

  return { data, loading, error };
}
