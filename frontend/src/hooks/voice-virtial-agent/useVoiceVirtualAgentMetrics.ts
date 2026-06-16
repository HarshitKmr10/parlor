'use client';
import { useState, useEffect } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface VoiceVirtualAgentDashboardData {
  total_calls_handled: number;
  total_issues_handled: number;
  issue_resolution_rate: number;
  average_call_duration: number;
}

export interface VoiceVirtualAgentDashboardApiResponse {
  success: boolean;
  message: string;
  data: VoiceVirtualAgentDashboardData;
  total_count: number | null;
}

export function useVoiceVirtualAgentMetrics(org_id: string, timeframe?: string) {
  const [data, setData] = useState<VoiceVirtualAgentDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
  const fetchDashboardData = async () => {
      if (!org_id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      
      try {
        const queryParams = new URLSearchParams({
          org_id,
          period: timeframe || "",
        }).toString();

        const url = `/analytics/vva/dashboard?${queryParams}`;

        const response: {data: VoiceVirtualAgentDashboardApiResponse} = await serviceDeskInstance.get(url);
        
        
        if (response.data.success && response.data.data) {
          setData(response.data.data);
        } else {
          console.error('❌ API returned success=false or no data:', response.data);
          setError(new Error(response.data.message || 'Invalid API response'));
        }
      } catch (err: any) {
        console.error('❌ Voice Virtual Agent Dashboard data fetch failed:', err);
        console.error('📍 Error details:', {
          status: err?.response?.status,
          statusText: err?.response?.statusText,
          data: err?.response?.data,
          url: err?.config?.url,
          method: err?.config?.method,
          headers: err?.config?.headers,
          baseURL: err?.config?.baseURL
        });
        
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [org_id, timeframe]);

  return { data, loading, error };
} 