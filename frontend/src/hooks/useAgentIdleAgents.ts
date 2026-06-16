import { useState, useEffect } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

interface IdleAgentData {
  id: string;
  name: string;
  total_queries: number;
  resolved_queries: number;
  total_sessions: number;
  total_time_spent: number;
}

interface IdleAgentsResponse {
  success: boolean;
  message: string;
  data: {
    org_id: string;
    idle_agents: IdleAgentData[];
    idle_count: number;
  };
  total_count: number | null;
}

export function useAgentIdleAgents(org_id: string, timeframe: string, isVersionV3: boolean) {
  const [data, setData] = useState<IdleAgentsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchIdleAgents = async () => {
      setLoading(true);
      try {
        const queryParams = `org_id=${org_id}&period=${timeframe}`;
        const apiVersion = isVersionV3 ? 'v3' : 'v2';
        const res = await serviceDeskInstance.get(`/analytics/${apiVersion}/user_stats/idle_agents?${queryParams}`);
        setData(res.data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    if (org_id) fetchIdleAgents();
  }, [org_id, timeframe, isVersionV3]);

  return { data, loading, error };
}