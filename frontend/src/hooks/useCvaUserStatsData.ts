import { useEffect, useState } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface UserStat {
  user_id: string | null;
  name: string;
  total_queries: number;
  total_issues: number;
  tickets: number;
}

export interface UserStatsResponseData {
  users: UserStat[];
}

export interface UserStatsApiResponse {
  success: boolean;
  message: string;
  data: UserStatsResponseData;
  total_count: number | null;
}

export function useCvaUserStatsData(org_id: string, timeframe: string) {
  const [data, setData] = useState<UserStat[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchUserStatsData = async () => {
      if (!org_id || !timeframe) return;

      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          org_id,
          period: timeframe,
        }).toString();

        const response = await serviceDeskInstance.get<UserStatsApiResponse>(
          `/analytics/v2/cva/user_stats?${queryParams}`
        );

        setData(response?.data?.data?.users);
      } catch (err) {
        console.error('User stats data fetch failed:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserStatsData();
  }, [org_id, timeframe]);

  return { data, loading, error };
}
