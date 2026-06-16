// hooks/useAgentAssistDashboardData.ts
import { useState, useEffect } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';


export interface AgentAssistDashboardData {
  org_id: string;
  org: {
    users: number;
    kb_collections: number;
    kb_documents: number;
  };
  agent_assist: {
    agent_count: number;
    queries: number;
    answered_queries: number;
    tickets_created: number;
    tickets_resolved: number;
    total_tickets: number;
    time_spent_by_agent: Record<string, number>;
    chat_sessions: number;
    total_users: number;
    ticketing_funnel: {
      total_queries: number;
      total_issues: number;
      total_tickets_created: number;
      tickets_discussed: number;
      tickets_resolved: number;
      issue_resolution_rate: number;
      resolved_issues: number;
      unresolved_issues: number;
      tickets_in_progress: number;
      ticket_details: {
        discussed_ticket_ids: string[];
        resolved_ticket_ids: string[];
      };
    };
  };
}

export function useAgentAssistDashboardData(org_id: string, timeframe?: string, isVersionV3?: boolean) {
  const [data, setData] = useState<AgentAssistDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchAgentAssistData = async () => {
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
        const res = await serviceDeskInstance.get(`/analytics/${apiVersion}/dashboard?${queryParams}`);
        setData(res?.data?.data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    if (org_id) {
      fetchAgentAssistData();
    }
  }, [org_id, timeframe, isVersionV3]);

  return { data, loading, error };
}
