// hooks/useAgentUserStats.ts
import { useEffect, useState } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface AgentStats {
  total_sessions: number;
  total_queries: number;
  total_time_spent: number;
  name: string;
}

export interface AgentUserStats {
  user_stats: Record<string, AgentStats>;
  active_user_stats: Record<string, AgentStats>;
  total_users: number;
  tickets_by_date: {
    date: string;
    total_tickets: number;
    resolved_tickets: number;
  }[];
}

export function useAgentUserStats(org_id: string | undefined, timeframe: string, isVersionV3: boolean) {
  const [data, setData] = useState<AgentUserStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchUserStats = async () => {
      if (!org_id) return;
      setLoading(true);

      try {
        const queryParams = `org_id=${org_id}&period=${timeframe}`;
        const apiVersion = isVersionV3 ? 'v3' : 'v2';
        const res = await serviceDeskInstance.get(`/analytics/${apiVersion}/user_stats?${queryParams}`);

        setData({
          user_stats: res.data.data.user_stats,
          active_user_stats: res.data.data.active_user_stats,
          total_users: res.data.data.total_users,
          tickets_by_date: res.data.data.tickets_by_date,
        });
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserStats();
  }, [org_id, timeframe, isVersionV3]);

  return { data, loading, error };
}
