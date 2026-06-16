import { useEffect, useState } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface TopQuery {
  query: string;
  count: number;
}

export function useCvaTopQueriesData(
  org_id: string,
  timeframe: string,
  query_type: 'answered' | 'unanswered' = 'answered',
  page: number,
  pageSize = 20
) {
  const [data, setData] = useState<TopQuery[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  // Reset data if filter/timeframe changes and page is 1
  useEffect(() => {
    if (page === 1) {
      setData([]);
    }
  }, [org_id, timeframe, query_type, page]);

  useEffect(() => {
    if (!org_id || !timeframe || !query_type || page === 0) return;

    const fetchTopQueries = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          org_id,
          period: timeframe,
          query_type,
          page: String(page),
          page_size: String(pageSize),
        }).toString();

        const res = await serviceDeskInstance.get(
          `/analytics/v2/cva/top_queries?${queryParams}`
        );

        const newQueries: TopQuery[] = res.data?.data?.queries || [];
        setData(prev => page === 1 ? newQueries : [...prev, ...newQueries]);
        setHasMore(newQueries.length > 0);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTopQueries();
  }, [org_id, timeframe, query_type, page, pageSize]);

  return { data, loading, error, hasMore };
}
