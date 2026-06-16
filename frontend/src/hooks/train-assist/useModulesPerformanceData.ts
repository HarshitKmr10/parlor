'use client';
import { useState, useEffect } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface ModulePerformanceData {
  name: string;
  topicsCompleted: number;
  avgQuizScore: number;
  simulationsCompleted: number;
}

interface TopicPerformanceData {
  avg_quiz_score: number;
  quiz_submissions: number;
}

interface ApiQuizTopicPerformanceData {
  [topicName: string]: TopicPerformanceData;
}

interface QuizTopicPerformanceApiResponse {
  success: boolean;
  message: string;
  data: ApiQuizTopicPerformanceData;
  total_count: number | null;
}

interface UseModulesPerformanceDataProps {
  timePeriod?: string;
  orgId?: string;
  tagId?: string;
}

interface UseModulesPerformanceDataReturn {
  data: ModulePerformanceData[] | null;
  loading: boolean;
  error: string | null;
}

export const useModulesPerformanceData = ({
  timePeriod = '30 days',
  orgId,
  tagId
}: UseModulesPerformanceDataProps = {}): UseModulesPerformanceDataReturn => {
  const [data, setData] = useState<ModulePerformanceData[] | null>(null);
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
          period: timePeriod || "",
          tag_id: tagId === "all" ? "" : tagId
        }).toString();

        const url = `/analytics/module-performance-summary?${queryParams}`;
        

        const response: {data: { success: boolean; message: string; data: ModulePerformanceData[]; total_count: number | null }} = await serviceDeskInstance.get(url);


        if (response.data.success && response.data.data) {
          
          // Transform API data to ModulePerformanceData interface
          const transformedData: ModulePerformanceData[] = response.data.data;

          
          setData(transformedData);
          
        } else {
          console.error('❌ Invalid API response structure:', {
            success: response.data.success,
            dataExists: !!response.data.data,
            dataKeys: response.data.data ? Object.keys(response.data.data) : 'no data',
            fullResponse: response.data
          });
          
          if (response.data.success && (!response.data.data || Object.keys(response.data.data).length === 0)) {
            setData([]);
          } else {
            setError('Invalid API response structure');
          }
        }
      } catch (err: any) {
        console.error('❌ Error fetching modules performance data:', err);
        console.error('📍 Error details:', {
          status: err?.response?.status,
          statusText: err?.response?.statusText,
          data: err?.response?.data,
          url: err?.config?.url,
          method: err?.config?.method,
          headers: err?.config?.headers,
          baseURL: err?.config?.baseURL
        });
        setError(`Failed to load modules performance data: ${err?.response?.status || 'Network error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timePeriod, orgId, tagId]);

  return {
    data,
    loading,
    error,
  };
}; 