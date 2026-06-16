// hooks/useAgentAssistCategories.ts
import { useState, useEffect } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface IssueCategory {
  name: string;
  count: number;
}

export interface AgentAssistCategoriesData {
  org_id: string;
  categories: IssueCategory[];
  total_categories: number;
}

export interface AgentAssistCategoriesResponse {
  success: boolean;
  message: string;
  data: AgentAssistCategoriesData;
  total_count: number | null;
}

export function useAgentAssistCategories(org_id: string, timeframe?: string, isVersionV3?: boolean) {
  const [data, setData] = useState<AgentAssistCategoriesData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchAgentAssistCategories = async () => {
      setLoading(true);
      try {
        let queryParams = `org_id=${org_id}`;

        if (timeframe) {
          queryParams += `&period=${timeframe}`;
        } else {
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 30);

          const formattedStartDate = startDate.toISOString().split('T')[0];
          const formattedEndDate = endDate.toISOString().split('T')[0];

          queryParams += `&period=${formattedStartDate}:${formattedEndDate}`;
        }

        const apiVersion = isVersionV3 ? 'v3' : 'v2';
        const response = await serviceDeskInstance.get(`/analytics/${apiVersion}/issue_categories?${queryParams}`);
        
        if (response.data?.success) {
          setData(response.data.data);
        } else {
          throw new Error(response.data?.message || 'Failed to fetch issue categories');
        }
      } catch (err) {
        setError(err);
        console.error('Error fetching agent assist categories:', err);
      } finally {
        setLoading(false);
      }
    };

    if (org_id) {
      fetchAgentAssistCategories();
    }
  }, [org_id, timeframe, isVersionV3]);

  return { data, loading, error };
}
