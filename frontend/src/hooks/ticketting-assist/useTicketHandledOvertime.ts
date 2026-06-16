import { useEffect, useState } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface TicketHandledData {
  date: string;
  created: number;
  resolved: number;
}

export interface TicketHandledApiResponse {
  success: boolean;
  message: string;
  data: TicketHandledData[];
}

export function useTicketHandledOvertime(org_id: string, timeframe: string, interval = 'day') {
  const [data, setData] = useState<TicketHandledData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchTicketHandledOvertime = async () => {
      if (!org_id || !timeframe) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await serviceDeskInstance.get<TicketHandledApiResponse>(
          `/analytics/v1/tva/ticket-handled-overtime?org_id=${org_id}&period=${timeframe}&interval=${interval}`
        );
        setData(response.data.data);
      } catch (err) {
        console.error('Ticket handled overtime fetch failed:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTicketHandledOvertime();
  }, [org_id, timeframe, interval]);

  return { data, loading, error };
}
