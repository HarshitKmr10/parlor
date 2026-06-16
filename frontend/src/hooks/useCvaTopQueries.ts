// hooks/useTopQueries.ts
import { useState, useEffect } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface TopQuery {
  query: string;
  count: number;
}

export function useTopQueries(org_id: string, timeframe: string) {
  const [data, setData] = useState<TopQuery[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchTopQueries = async () => {
      setLoading(true);
      try {
        const queryParams = `org_id=${org_id}&period=${timeframe}`;
        const res = await serviceDeskInstance.get(`/analytics/cva_top_answered_queries?${queryParams}`);
        setData(res.data.data.recurring_incidents);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    if (org_id) {
      fetchTopQueries();
    }
  }, [org_id, timeframe]);

  return { data, loading, error };
}
