'use client';

import { useState, useEffect } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

// ─── Types & Interfaces ─────────────────────────────────────────────────────

/**
 * Represents a single top query entry with its count
 */
export interface TopQueryData {
  query: string;
  total_count: number;
}

/**
 * API response structure for top queries endpoint
 */
interface TopQueriesApiResponse {
  success: boolean;
  message: string;
  data: {
    queries: TopQueryData[];
    total_count: number;
    page: number;
    page_size: number;
    answered: boolean;
  };
  total_count: number | null;
}

/**
 * Props for the useTopQueries hook
 */
interface useTopQueriesProps {
  orgId?: string;
  timeframe?: string;
  answered?: boolean;
  page?: number;
  pageSize?: number;
  filterKey?: number; // Force refetch when filters change
}

/**
 * Return type for the useTopQueries hook
 */
interface useTopQueriesReturn {
  data: TopQueryData[] | null;
  loading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
}

// ─── Hook Implementation ────────────────────────────────────────────────────

/**
 * Custom hook to fetch top queries data from Voice Virtual Agent API
 * 
 * @param orgId - Organization ID for filtering data
 * @param timeframe - Date range filter (e.g., "2024-01-01:2024-01-31")
 * @param answered - Filter for answered/unanswered queries (default: true)
 * @param page - Page number for pagination (default: 1)
 * @param pageSize - Number of items per page (default: 10)
 * 
 * @returns Object containing queries data, loading state, error state, total count, and pagination info
 */
export const useTopQueries = ({
  orgId,
  timeframe,
  answered = true,
  page = 1,
  pageSize = 10,
  filterKey,
}: useTopQueriesProps): useTopQueriesReturn => {
  // ─── State Management ─────────────────────────────────────────────────────
  
  const [data, setData] = useState<TopQueryData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // ─── Data Fetching Logic ─────────────────────────────────────────────────
  
  useEffect(() => {
    const fetchData = async () => {
      // Early return if no organization ID is provided
      if (!orgId) {
        setLoading(false);
        return;
      }

      try {
        // Reset states for new request
        setLoading(true);
        setError(null);

        // Build query parameters
        const queryParams = new URLSearchParams({
          org_id: orgId,
          period: timeframe || '',
          answered: answered.toString(),
          page: page.toString(),
          page_size: pageSize.toString(),
        }).toString();

        const url = `/analytics/vva/top_queries?${queryParams}`;

        // Make API request
        const response: { data: TopQueriesApiResponse } = await serviceDeskInstance.get(url);

        // Handle successful response
        if (response.data.success && response.data.data) {
          setData(response.data.data.queries);
          setTotalCount(response.data.data.total_count);
          // Check if there are more pages available
          setHasMore(response.data.data.queries.length === pageSize);
        } else {
          // Handle invalid API response structure
          console.error('❌ Invalid API response structure:', {
            success: response.data.success,
            dataExists: !!response.data.data,
            fullResponse: response.data,
          });
          setError('Invalid API response structure');
        }
      } catch (err: any) {
        // Handle API errors
        console.error('❌ Error fetching top queries data:', err);
        console.error('📍 Error details:', {
          status: err?.response?.status,
          statusText: err?.response?.statusText,
          data: err?.response?.data,
          url: err?.config?.url,
          method: err?.config?.method,
          headers: err?.config?.headers,
          baseURL: err?.config?.baseURL,
        });
        setError(
          `Failed to load top queries data: ${err?.response?.status || 'Network error'}`,
        );
      } finally {
        // Always set loading to false when request completes
        setLoading(false);
      }
    };

    // Execute data fetching
    fetchData();
  }, [orgId, timeframe, answered, page, pageSize, filterKey]); // Dependencies for useEffect

  // ─── Return Hook State ───────────────────────────────────────────────────
  
  return {
    data,
    loading,
    error,
    totalCount,
    hasMore,
  };
}; 