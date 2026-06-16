import { useEffect, useState } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

// ─── Types ─────────────────────────────────────────────────
export interface IssueDetail {
  issue: string;
  issue_type: string;
  issue_count: number;
  employee_count: number;
  ipe: number;
  resolution_rate: string;
}

interface IssueDetailsApiResponse {
  success: boolean;
  message: string;
  data: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    issues: IssueDetail[];
  };
}

// ─── Hook ──────────────────────────────────────────────────
export function useCvaIssueDetailsData(
  orgId: string,
  period: string,
  page: number,
  pageSize = 10
) {
  const [data, setData] = useState<IssueDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (page === 1) {
      setData([]);
    }
  }, [orgId, period, page]);

  useEffect(() => {
    if (!orgId || !period || page === 0) return;

    const fetchIssueDetails = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          org_id: orgId,
          period,
          page: String(page),
          page_size: String(pageSize),
        }).toString();

        const res = await serviceDeskInstance.get<IssueDetailsApiResponse>(
          `/analytics/v2/cva/issue_details?${queryParams}`
        );

        const newIssues = res.data?.data?.issues || [];
        setData((prev) => (page === 1 ? newIssues : [...prev, ...newIssues]));
        setHasMore(newIssues.length === pageSize);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchIssueDetails();
  }, [orgId, period, page, pageSize]);

  return { data, loading, hasMore, error };
}