'use client';
import { useState, useEffect } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface ProgressFunnel {
  topic_started: number;
  quizes_attempted: number;
  simulation_done: number;
}

export interface TrainAssistDashboardData {
  total_learners: number;
  average_quiz_score: number;
  average_attempts_before_pass: number;
  average_overall_progress: number;
  progress_funnel: ProgressFunnel;
}

export interface TrainAssistDashboardApiResponse {
  success: boolean;
  message: string;
  data: TrainAssistDashboardData;
  total_count: number | null;
}

export function useTrainAssistMetrics(org_id: string, timeframe?: string, tagId?: string) {
  const [data, setData] = useState<TrainAssistDashboardData | null>(null);
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
          tag_id: tagId === 'all' ? '' : tagId
        }).toString();

        const url = `/analytics/train_assist_dashboard?${queryParams}`;

        const response: {data: TrainAssistDashboardApiResponse} = await serviceDeskInstance.get(url);
        
        
        if (response.data.success && response.data.data) {
          setData(response.data.data);
        } else {
          console.error('❌ API returned success=false or no data:', response.data);
          setError(new Error(response.data.message || 'Invalid API response'));
        }
      } catch (err: any) {
        console.error('❌ Train Assist Dashboard data fetch failed:', err);
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
  }, [org_id, timeframe , tagId]);

  return { data, loading, error };
} 