'use client';

import { useState, useEffect } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

// ─── Types & Interfaces ─────────────────────────────────────────────────────

/**
 * Represents a single top reported issue entry with all its metrics
 */
export interface TopReportedIssueData {
  issue_description: string;
  category: string;
  severity: string;
  total_occurrences: number;
  tickets_created: number;
  resolution_rate: number;
  affected_users_count: number;
  systems_affected: string[];
  common_symptoms: string[];
  recent_occurrences: Array<{
    date: string;
    user: string;
    ticket_id: string;
  }>;
}

/**
 * API response structure for top reported issues endpoint
 */
interface TopReportedIssuesApiResponse {
  success: boolean;
  message: string;
  data: {
    issues: TopReportedIssueData[];
    summary: {
      total_unique_issues: number;
      total_occurrences: number;
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
 * Props for the useTopReportedIssues hook
 */
interface useTopReportedIssuesProps {
  orgId?: string;
  timeframe?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Return type for the useTopReportedIssues hook
 */
interface useTopReportedIssuesReturn {
  data: TopReportedIssueData[] | null;
  loading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
}

// ─── Hook Implementation ────────────────────────────────────────────────────

/**
 * Custom hook to fetch top reported issues data from Voice Virtual Agent API
 * 
 * @param orgId - Organization ID for filtering data
 * @param timeframe - Date range filter (e.g., "2024-01-01:2024-01-31")
 * @param page - Page number for pagination (default: 1)
 * @param pageSize - Number of items per page (default: 10)
 * 
 * @returns Object containing issues data, loading state, error state, total count, and pagination info
 */
export const useTopReportedIssues = ({
  orgId,
  timeframe,
  page = 1,
  pageSize = 10,
}: useTopReportedIssuesProps): useTopReportedIssuesReturn => {
  // ─── State Management ─────────────────────────────────────────────────────
  
  const [data, setData] = useState<TopReportedIssueData[] | null>(null);
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
          page: page.toString(),
          page_size: pageSize.toString(),
        }).toString();

        const url = `/analytics/vva/top_reported_issues?${queryParams}`;

        // Make API request
        const response: { data: TopReportedIssuesApiResponse } = await serviceDeskInstance.get(url);

        // Handle successful response
        if (response.data.success && response.data.data) {
          setData(response.data.data.issues);
          setTotalCount(response.data.data.summary.total_occurrences);
          // Check if there are more pages available
          setHasMore(response.data.data.summary.page < response.data.data.summary.total_pages);
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
        console.error('❌ Error fetching top reported issues data:', err);
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
          `Failed to load top reported issues data: ${err?.response?.status || 'Network error'}`,
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
  };
}; 