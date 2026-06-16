import { useEffect, useState } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface GroupData {
  group: string;
  count: number;
}

export interface AssignedGroupMetrics {
  top_groups: GroupData[];
  bottom_groups: GroupData[];
}

export interface AssignedGroupMetricsApiResponse {
  success: boolean;
  message: string;
  data: AssignedGroupMetrics;
}

export function useAssignedGroupMetrics(
  org_id: string, 
  timeframe: string, 
  top_k = 5, 
  bottom_k = 5
) {
  const [data, setData] = useState<AssignedGroupMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchAssignedGroupMetrics = async () => {
      if (!org_id || !timeframe) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await serviceDeskInstance.get<AssignedGroupMetricsApiResponse>(
          `/analytics/v1/tva/assigned-group-metrics?org_id=${org_id}&period=${timeframe}&top_k=${top_k}&bottom_k=${bottom_k}`
        );
        setData(response.data.data);
      } catch (err) {
        console.error('Assigned group metrics fetch failed:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAssignedGroupMetrics();
  }, [org_id, timeframe, top_k, bottom_k]);

  return { data, loading, error };
}
