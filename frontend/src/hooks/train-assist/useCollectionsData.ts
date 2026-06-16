'use client';
import { useState, useEffect } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface CollectionData {
  name: string;
  total_topics: number;
  completion: number; // percentage of completed topics
}

interface TopicCompletionData {
  avg_quiz_score: number;
  completed_topics: number;
  module_completions: number;
  quiz_attempts: number;
  quiz_pass_rate: number;
  quiz_passes: number;
  total_activities: number;
  unique_topics: number;
  unique_users: number;
  total_topics: number;
}

interface ApiTopicModuleData {
  [topicName: string]: TopicCompletionData;
}

interface TopicModuleCompletionApiResponse {
  success: boolean;
  message: string;
  data: ApiTopicModuleData;
  total_count: number | null;
}

interface UseCollectionsDataProps {
  orgId?: string;
  timeframe?: string;
  tagId?: string;
}

interface UseCollectionsDataReturn {
  data: CollectionData[] | null;
  loading: boolean;
  error: string | null;
}

export const useCollectionsData = ({
  orgId,
  timeframe,
  tagId
}: UseCollectionsDataProps): UseCollectionsDataReturn => {
  const [data, setData] = useState<CollectionData[] | null>(null);
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
          period: timeframe || "",
          tag_id: tagId === "all" ? "" : tagId
        }).toString();

        const url = `/analytics/collection-overview?${queryParams}`;

        const response: {data: TopicModuleCompletionApiResponse} = await serviceDeskInstance.get(url);

        if (response.data.success && response.data.data) {
          
          // Transform API data to CollectionData interface - data is an object with topic names as keys
          const transformedData: CollectionData[] = Object.entries(response.data.data).map(([topicName, completionData]) => {
            const completion = completionData?.total_topics
              ? (completionData.completed_topics / completionData.total_topics) * 100
              : 0;
            return {
              name: topicName || 'Unknown Topic',
              total_topics: completionData?.total_topics || 0,
              completion,
            };
          });

          setData(transformedData);
        } else {
          console.error('❌ Invalid API response structure:', {
            success: response.data.success,
            dataExists: !!response.data.data,
            dataKeys: response.data.data ? Object.keys(response.data.data) : 'no data',
            fullResponse: response.data
          });
          
          // If no data but successful response, set empty array instead of error
          if (response.data.success && (!response.data.data || Object.keys(response.data.data).length === 0)) {
            setData([]);
          } else {
            setError('Invalid API response structure');
          }
        }
      } catch (err: any) {
        console.error('❌ Error fetching collections data:', err);
        console.error('📍 Error details:', {
          status: err?.response?.status,
          statusText: err?.response?.statusText,
          data: err?.response?.data,
          url: err?.config?.url,
          method: err?.config?.method,
          headers: err?.config?.headers,
          baseURL: err?.config?.baseURL
        });
        setError(`Failed to load collections data: ${err?.response?.status || 'Network error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgId, timeframe, tagId]);

  return {
    data,
    loading,
    error,
  };
}; 