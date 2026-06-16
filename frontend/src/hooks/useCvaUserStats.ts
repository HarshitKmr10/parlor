// hooks/useUserStats.ts
import { useState, useEffect } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface AgentStats {
  total_sessions: number;
  total_queries: number;
  total_time_spent: number;
  name: string;
}

export interface UserStats {
  [key: string]: AgentStats;
}

export function useUserStats(org_id: string, timeframe: string) {
  const [data, setData] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchUserStats = async () => {
      setLoading(true);
      try {
        const queryParams = `org_id=${org_id}&period=${timeframe}`;
        const res = await serviceDeskInstance.get(`/analytics/cva_user_stats?${queryParams}`);
        setData(res.data.data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    if (org_id) {
      fetchUserStats();
    }
  }, [org_id, timeframe]);

  return { data, loading, error };
}
