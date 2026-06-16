// hooks/useAgentAssistIssueDetails.ts
import { useState, useEffect } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface IssueDetail {
  issue: string;
  issue_type: string;
  issue_count: number;
  employee_count: number;
  trend: number;
  resolution_rate: string;
}

export interface AgentAssistIssueDetailsData {
  org_id: string;
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  issues: IssueDetail[];
}

export interface AgentAssistIssueDetailsResponse {
  success: boolean;
  message: string;
  data: AgentAssistIssueDetailsData;
  total_count: number | null;
}

export function useAgentAssistIssueDetails(
  org_id: string,
  timeframe?: string,
  isVersionV3?: boolean,
  page = 1,
  page_size = 10
) {
  const [data, setData] = useState<AgentAssistIssueDetailsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchAgentAssistIssueDetails = async () => {
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

        // Add pagination parameters
        queryParams += `&page=${page}&page_size=${page_size}`;

        const apiVersion = isVersionV3 ? 'v3' : 'v2';
        const response = await serviceDeskInstance.get(`/analytics/${apiVersion}/issue_details?${queryParams}`);

        if (response.data?.success) {
          setData(response.data.data);
        } else {
          throw new Error(response.data?.message || 'Failed to fetch issue details');
        }
      } catch (err) {
        setError(err);
        console.error('Error fetching agent assist issue details:', err);
      } finally {
        setLoading(false);
      }
    };

    if (org_id) {
      fetchAgentAssistIssueDetails();
    }
  }, [org_id, timeframe, isVersionV3, page, page_size]);

  return { data, loading, error };
}
