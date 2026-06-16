'use client';
import { useState, useEffect, useCallback } from 'react';
import { aiAgentInstance } from '../../api/common/axiosInstance'; // Adjust path if needed
import { format } from 'date-fns';

// --- Interfaces for API Responses --- 

interface PercentageResolvedResponse {
  error: string | null;
  data: {
    percentage: number;
    total_tickets: number;
    resolved_tickets: number;
  };
  meta: any;
}

interface MeanTimeToResolveResponse {
  error: string | null;
  data: {
    mean_time_hours: number;
    median_time_hours: number;
    min_time_hours: number;
    max_time_hours: number;
    total_tickets: number;
  };
  meta: any;
}

interface FirstTouchResolveResponse {
  error: string | null;
  data: {
    percentage: number;
    total_tickets: number;
    resolved_tickets: number;
    category_metrics: any; // Assuming we only need the top-level percentage
  };
  meta: any;
}

interface WeeklyVolumeChangeResponse {
  error: string | null;
  data: {
    weekly_metrics: {
      [weekStartDate: string]: {
        volume: number;
        pct_change: number | null;
      };
    };
    total_weeks: number;
    total_tickets: number;
  };
  meta: any;
}

// --- Interface for the combined metrics returned by the hook --- 

export interface TicketAssistMetrics {
  resolutionRate: number | null;
  meanTimeToResolve: number | null;
  firstTouchResolutionRate: number | null;
  weeklyChange: number | null; // Represents the latest pct_change
}

export function useTicketAssistMetrics(org_id: string | undefined, startDate: Date | null, endDate: Date | null) {
  const [metrics, setMetrics] = useState<TicketAssistMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  // --- Define fetchData using useCallback --- 
  const fetchData = useCallback(async () => {
    if (!org_id || !startDate || !endDate) {
      console.warn('Skipping metrics fetch: Missing org_id or dates');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');
    const params = `start_date=${formattedStartDate}&end_date=${formattedEndDate}`;

    try {
      const [resRateRes, mttrRes, ftrRes, weeklyChangeRes] = await Promise.all([
        aiAgentInstance.get<PercentageResolvedResponse>(`/ticket-assist/percentage-resolved?${params}`),
        aiAgentInstance.get<MeanTimeToResolveResponse>(`/ticket-assist/mean-time-to-resolve?${params}`),
        aiAgentInstance.get<FirstTouchResolveResponse>(`/ticket-assist/first-touch-resolve?${params}`),
        aiAgentInstance.get<WeeklyVolumeChangeResponse>(`/ticket-assist/weekly-volume-change?${params}`),
      ]);

      // Extract latest weekly change percentage
      let latestWeeklyChange: number | null = null;
      if (weeklyChangeRes.data?.data?.weekly_metrics) {
        const weeks = Object.keys(weeklyChangeRes.data.data.weekly_metrics).sort();
        if (weeks.length > 0) {
          const latestWeekKey = weeks[weeks.length - 1];
          latestWeeklyChange = weeklyChangeRes.data.data.weekly_metrics[latestWeekKey]?.pct_change ?? null;
        }
      }

      const combinedMetrics: TicketAssistMetrics = {
        resolutionRate: resRateRes.data?.data?.percentage ?? null,
        meanTimeToResolve: mttrRes.data?.data?.mean_time_hours ?? null,
        firstTouchResolutionRate: ftrRes.data?.data?.percentage ?? null,
        weeklyChange: latestWeeklyChange,
      };

      setMetrics(combinedMetrics);

    } catch (err: any) {
      // Improved error handling: Log the specific error
      console.error("Error fetching ticket assist metrics:", err);
      // Check if it's an Axios error to potentially get more detail
      if (err.response) {
          console.error('Error details:', err.response.data);
          setError(err.response.data); 
      } else if (err.request) {
          console.error('No response received:', err.request);
          setError('Network error or no response from server.');
      } else {
          console.error('Error setting up request:', err.message);
          setError(err.message);
      }
      setMetrics(null); // Reset metrics on error
    } finally {
      setLoading(false);
    }
  }, [org_id, startDate, endDate]); // Dependencies for useCallback

  // --- useEffect for initial fetch --- 
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Return refetch function --- 
  return { metrics, loading, error, refetch: fetchData };
} 