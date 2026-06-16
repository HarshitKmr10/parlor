'use client';
import { useState, useEffect } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface IssueCategoryData {
  category: string;
  count: number;
  total_issues: number;
  severity_breakdown: Record<string, number>;
  percentage: number;
}

export interface IssueCategoriesSummary {
  total_categories: number;
  total_issues: number;
  period_analyzed: {
    start_date: string;
    end_date: string;
  };
}

interface IssueCategoriesApiResponse {
  success: boolean;
  message: string;
  data: {
    categories: IssueCategoryData[];
    summary: IssueCategoriesSummary;
  } | { error: string };
  total_count: number | null;
}

interface useIssueCategoriesProps {
  orgId?: string;
  timeframe?: string;
  tagId?: string;
}

interface useIssueCategoriesReturn {
  data: IssueCategoryData[] | null;
  summary: IssueCategoriesSummary | null;
  loading: boolean;
  error: string | null;
}

export const useIssueCategories = ({
  orgId,
  timeframe,
}: useIssueCategoriesProps): useIssueCategoriesReturn => {
  const [data, setData] = useState<IssueCategoryData[] | null>(null);
  const [summary, setSummary] = useState<IssueCategoriesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!orgId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const queryParams = new URLSearchParams({
          org_id: orgId,
          period: timeframe || '',
        }).toString();

        const url = `/analytics/vva/issue_categories?${queryParams}`;

        const response: { data: IssueCategoriesApiResponse } = await serviceDeskInstance.get(url);

        if (response.data.success && response.data.data) {
          // Check if data has the new structure with categories and summary
          if ('categories' in response.data.data && 'summary' in response.data.data) {
            const categoriesData = response.data.data.categories;
            const summaryData = response.data.data.summary;
            
            setData(categoriesData);
            setSummary(summaryData);
            
          } else if ('error' in response.data.data) {
            // Handle error case
            setError(response.data.data.error || 'Unknown error');
            setData(null);
            setSummary(null);
          } else {
            // Handle unexpected data structure
            setError('Unexpected API response structure');
            setData(null);
            setSummary(null);
          }
        } else {

          // If no data but successful response, set empty arrays
          if (response.data.success && (!response.data.data || 
              ('categories' in response.data.data && response.data.data.categories.length === 0))) {
            setData([]);
            setSummary(null);
          } else {
            setError('Invalid API response structure');
            setData(null);
            setSummary(null);
          }
        }
      } catch (err: any) {
        setError(
          `Failed to load issue categories data: ${err?.response?.status || 'Network error'}`,
        );
        setData(null);
        setSummary(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgId, timeframe]);

  return {
    data,
    summary,
    loading,
    error,
  };
};
