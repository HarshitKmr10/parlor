'use client';

import { useState, useEffect } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

// ─── Types & Interfaces ─────────────────────────────────────────────────────

/**
 * Represents a single knowledge base entry with its usage count
 */
export interface MostUsedKbData {
  kb_name: string;
  total_uses: number;
  unique_calls: number;
  usage_rate: number;
  recent_usage: Array<{
    date: string;
    call_id: string;
  }>;
}

/**
 * API response structure for most used KBs endpoint
 */
interface MostUsedKbsApiResponse {
  success: boolean;
  message: string;
  data: {
    kbs: MostUsedKbData[];
    summary: {
      total_unique_kbs: number;
      total_kb_usage: number;
      page: number;
      page_size: number;
      total_pages: number;
    };
    filter: {
      period: string;
      date_range: {
        start_date: string;
        end_date: string;
      };
    };
  };
  total_count: number | null;
}

/**
 * Props for the useMostUsedKbs hook
 */
interface useMostUsedKbsProps {
  orgId?: string;
  timeframe?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Return type for the useMostUsedKbs hook
 */
interface useMostUsedKbsReturn {
  data: MostUsedKbData[] | null;
  loading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  summary: {
    total_unique_kbs: number;
    total_kb_usage: number;
    total_pages: number;
  } | null;
}

// ─── Hook Implementation ────────────────────────────────────────────────────

/**
 * Custom hook to fetch most used knowledge bases data from Voice Virtual Agent API
 * 
 * @param orgId - Organization ID for filtering data
 * @param timeframe - Date range filter (e.g., "2024-01-01:2024-01-31")
 * @param page - Page number for pagination (default: 1)
 * @param pageSize - Number of items per page (default: 10)
 * 
 * @returns Object containing KBs data, loading state, error state, total count, and pagination info
 */
export const useMostUsedKbs = ({
  orgId,
  timeframe,
  page = 1,
  pageSize = 10,
}: useMostUsedKbsProps): useMostUsedKbsReturn => {
  // ─── State Management ─────────────────────────────────────────────────────
  
  const [data, setData] = useState<MostUsedKbData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [summary, setSummary] = useState<{
    total_unique_kbs: number;
    total_kb_usage: number;
    total_pages: number;
  } | null>(null);

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
          page: page.toString(),
          page_size: pageSize.toString(),
        }).toString();

        const url = `/analytics/vva/most_used_kbs?${queryParams}`;

        // Make API request
        const response: { data: MostUsedKbsApiResponse } = await serviceDeskInstance.get(url);

        // Handle successful response
        if (response.data.success && response.data.data) {
          setData(response.data.data.kbs);
          setSummary(response.data.data.summary);
          setTotalCount(response.data.data.summary.total_unique_kbs);
          // Check if there are more pages available
          setHasMore(page < response.data.data.summary.total_pages);
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
        console.error('❌ Error fetching most used KBs data:', err);
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
          `Failed to load most used KBs data: ${err?.response?.status || 'Network error'}`,
        );
      } finally {
        // Always set loading to false when request completes
        setLoading(false);
      }
    };

    // Execute data fetching
    fetchData();
  }, [orgId, timeframe, page, pageSize]); // Dependencies for useEffect

  // ─── Return Hook State ───────────────────────────────────────────────────
  
  return {
    data,
    loading,
    error,
    totalCount,
    hasMore,
    summary,
  };
}; 