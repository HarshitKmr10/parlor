import { useState, useEffect } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

interface VCPSummary {
  total_sessions: number;
  total_queries: number;
  queries_with_citations: number;
  average_citations_per_query: number;
  total_citations: number;
  total_issues_identified: number;
  issue_resolution_rate: number;
  average_session_duration_min: number;
  ticket_create_suggestions: number;
  ticket_update_suggestions: number;
}

interface VCPTopQuery {
  query: string;
  total_count: number;
  answered_count: number;
  unanswered_count: number;
  answer_rate: number;
}

interface VCPTopQueriesResponse {
  queries: VCPTopQuery[];
  summary: {
    page: number;
    page_size: number;
    total_queries: number;
    has_more: boolean;
  };
}

interface VCPTrendItem {
  date: string;
  sessions: number;
  total_queries: number;
  queries_with_citations: number;
  average_citations_per_query: number;
  average_session_duration_min: number;
}

interface VCPIssues {
  by_category: Record<string, number>;
  by_type: Record<string, number>;
}

interface VCPAgent {
  agent_user_id: string;
  agent_name: string;
  total_sessions: number;
  total_queries: number;
  queries_with_citations: number;
  average_citations_per_query: number;
  average_session_duration_min: number;
  total_tickets: number;
  fcr_percentage: number;
}

interface VCPSession {
  id: string;
  meeting_id: string;
  agent_user_id: string;
  agent_name: string;
  employee_id: string;
  session_start: string;
  session_end: string;
  session_duration_sec: number;
  channel: string;
  total_queries: number;
  queries_with_citations: number;
  queries_without_citations: number;
  total_citations_count: number;
  ticket_create_suggestions: number;
  ticket_update_suggestions: number;
  has_resolver_group: boolean;
  has_vva_handover: boolean;
  total_issues_count: number;
}

interface VCPSessionsResponse {
  sessions: VCPSession[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

interface VCPTopIssue {
  normalized_query: string;
  category: string;
  type: string;
  count: number;
  resolved: number;
  unresolved: number;
  affected_sessions: number;
}

export interface VCPIssueDetail {
  issue: string;
  issue_type: string;
  issue_count: number;
  employee_count: number;
  resolution_rate: number;
  similar_queries: string[];
}

export interface VCPIssueDetailsResponse {
  issues: VCPIssueDetail[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

// Hook for summary metrics
export function useVCPSummary(org_id: string, period?: string) {
  const [data, setData] = useState<VCPSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!org_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ org_id });
        if (period) params.append('period', period);

        const response = await serviceDeskInstance.get(
          `/analytics/vcp/summary?${params.toString()}`
        );

        setData(response?.data?.data || null);
      } catch (err) {
        console.error('Failed to fetch VCP summary:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [org_id, period]);

  return { data, loading, error };
}

// Hook for trend data
export function useVCPTrend(org_id: string, period?: string) {
  const [data, setData] = useState<VCPTrendItem[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!org_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ org_id });
        if (period) params.append('period', period);

        const response = await serviceDeskInstance.get(
          `/analytics/vcp/trend?${params.toString()}`
        );

        setData(response?.data?.data || []);
      } catch (err) {
        console.error('Failed to fetch VCP trend:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [org_id, period]);

  return { data, loading, error };
}

// Hook for issue breakdown
export function useVCPIssues(org_id: string, period?: string) {
  const [data, setData] = useState<VCPIssues | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!org_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ org_id });
        if (period) params.append('period', period);

        const response = await serviceDeskInstance.get(
          `/analytics/vcp/issues?${params.toString()}`
        );

        setData(response?.data?.data || null);
      } catch (err) {
        console.error('Failed to fetch VCP issues:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [org_id, period]);

  return { data, loading, error };
}

// Hook for agent statistics
export function useVCPAgents(org_id: string, period?: string) {
  const [data, setData] = useState<VCPAgent[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!org_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ org_id });
        if (period) params.append('period', period);

        const response = await serviceDeskInstance.get(
          `/analytics/vcp/agents?${params.toString()}`
        );

        const responseData = response?.data?.data || [];
        console.log('VCP Agents response:', {
          agentsCount: Array.isArray(responseData) ? responseData.length : 0,
          data: responseData
        });
        setData(responseData);
      } catch (err) {
        console.error('Failed to fetch VCP agents:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [org_id, period]);

  return { data, loading, error };
}

// Hook for sessions list with pagination
export function useVCPSessions(
  org_id: string,
  period?: string,
  page = 1,
  limit = 20,
  agent_id?: string
) {
  const [data, setData] = useState<VCPSessionsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!org_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          org_id,
          page: page.toString(),
          limit: limit.toString()
        });

        if (period) params.append('period', period);
        if (agent_id) params.append('agent_id', agent_id);

        const response = await serviceDeskInstance.get(
          `/analytics/vcp/sessions?${params.toString()}`
        );

        const responseData = response?.data?.data || null;
        if (responseData) {
          console.log('VCP Sessions response:', {
            total: responseData.pagination?.total,
            sessionsCount: responseData.sessions?.length,
            page: responseData.pagination?.page
          });
        }
        setData(responseData);
      } catch (err) {
        console.error('Failed to fetch VCP sessions:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [org_id, period, page, limit, agent_id]);

  return { data, loading, error };
}

// Hook for individual session detail
export function useVCPSessionDetail(org_id: string, session_id: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!org_id || !session_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ org_id });

        const response = await serviceDeskInstance.get(
          `/analytics/vcp/sessions/${session_id}?${params.toString()}`
        );

        setData(response?.data?.data || null);
      } catch (err) {
        console.error('Failed to fetch VCP session detail:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [org_id, session_id]);

  return { data, loading, error };
}

// Hook for top issues with status filter
export function useVCPTopIssues(
  org_id: string,
  period?: string,
  status?: string,
  limit = 10
) {
  const [data, setData] = useState<VCPTopIssue[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!org_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          org_id,
          limit: limit.toString()
        });

        if (period) params.append('period', period);
        if (status) params.append('status', status);

        const response = await serviceDeskInstance.get(
          `/analytics/vcp/top_issues?${params.toString()}`
        );

        setData(response?.data?.data || []);
      } catch (err) {
        console.error('Failed to fetch VCP top issues:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [org_id, period, status, limit]);

  return { data, loading, error };
}

// Hook for issue details with pagination and filters
export function useVCPIssueDetails(
  org_id: string,
  period?: string,
  category?: string,
  issue_type?: string,
  page = 1,
  limit = 20
) {
  const [data, setData] = useState<VCPIssueDetailsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!org_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          org_id,
          page: page.toString(),
          limit: limit.toString()
        });

        if (period) params.append('period', period);
        if (category) params.append('category', category);
        if (issue_type) params.append('issue_type', issue_type);

        const response = await serviceDeskInstance.get(
          `/analytics/vcp/issue_details?${params.toString()}`
        );

        const responseData = response?.data?.data || null;
        if (responseData) {
          console.log('VCP Issue Details response:', {
            issuesCount: responseData.issues?.length,
            total: responseData.pagination?.total,
            page: responseData.pagination?.page
          });
        }
        setData(responseData);
      } catch (err) {
        console.error('Failed to fetch VCP issue details:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [org_id, period, category, issue_type, page, limit]);

  return { data, loading, error };
}

// Hook for top queries with answered/unanswered filter and pagination
export function useVCPTopQueries(
  org_id: string,
  period?: string,
  answered = true,
  page = 1,
  page_size = 10,
  filterKey?: number  // Used to force refetch when filter changes
) {
  const [data, setData] = useState<VCPTopQuery[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!org_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          org_id,
          answered: answered.toString(),
          page: page.toString(),
          page_size: page_size.toString()
        });

        if (period) params.append('period', period);

        const response = await serviceDeskInstance.get(
          `/analytics/vcp/top_queries?${params.toString()}`
        );

        const responseData = response?.data?.data || null;
        if (responseData) {
          console.log('VCP Top Queries response:', {
            queriesCount: responseData.queries?.length,
            total: responseData.summary?.total_queries,
            page: responseData.summary?.page,
            hasMore: responseData.summary?.has_more
          });
          setData(responseData.queries || []);
          setHasMore(responseData.summary?.has_more || false);
          setTotalCount(responseData.summary?.total_queries || 0);
        }
      } catch (err) {
        console.error('Failed to fetch VCP top queries:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [org_id, period, answered, page, page_size, filterKey]);

  return { data, loading, error, hasMore, totalCount };
}