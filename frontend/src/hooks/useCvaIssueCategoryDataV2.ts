import { useEffect, useState } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface IssueCategory {
  name: string;
  count: number;
}

export interface IssueCategoryResponseData {
  categories: IssueCategory[];
}

export interface IssueCategoryApiResponse {
  success: boolean;
  message: string;
  data: IssueCategoryResponseData;
  total_count: number | null;
}

export function useCvaIssueCategoryDataV2(org_id: string, timeframe: string) {
  const [data, setData] = useState<IssueCategory[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchIssueCategoryData = async () => {
      if (!org_id || !timeframe) return;

      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          org_id,
          period: timeframe,
        }).toString();

        const response = await serviceDeskInstance.get<IssueCategoryApiResponse>(
          `/analytics/v2/cva/issue_categories?${queryParams}`
        );

        setData(response?.data?.data?.categories);
      } catch (err) {
        console.error('Issue category data fetch failed:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchIssueCategoryData();
  }, [org_id, timeframe]);

  return { data, loading, error };
}
