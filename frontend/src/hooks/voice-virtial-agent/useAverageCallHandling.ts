'use client';
import { useState, useEffect } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface CallHandlingData {
  date: string;
  calls: number;
  average_time: number;
}

interface AverageCallHandlingApiResponse {
  success: boolean;
  message: string;
  data: CallHandlingData[];
  total_count: number | null;
}

interface useAverageCallHandlingProps {
  orgId?: string;
  timeframe?: string;
  tagId?: string;
}

interface useAverageCallHandlingReturn {
  data: CallHandlingData[] | null;
  loading: boolean;
  error: string | null;
}

export const useAverageCallHandling = ({
  orgId,
  timeframe,
}: useAverageCallHandlingProps): useAverageCallHandlingReturn => {
  const [data, setData] = useState<CallHandlingData[] | null>(null);
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
        }).toString();

        const url = `/analytics/vva/average_call_handling_status?${queryParams}`;

        const response: {data: AverageCallHandlingApiResponse} = await serviceDeskInstance.get(url);

        if (response.data.success && response.data.data) {
          setData(response.data.data);
        } else {
          console.error('❌ Invalid API response structure:', {
            success: response.data.success,
            dataExists: !!response.data.data,
            dataLength: response.data.data ? response.data.data.length : 'no data',
            fullResponse: response.data
          });
          
          // If no data but successful response, set empty array instead of error
          if (response.data.success && (!response.data.data || response.data.data.length === 0)) {
            setData([]);
          } else {
            setError('Invalid API response structure');
          }
        }
      } catch (err: any) {
        console.error('❌ Error fetching average call handling data:', err);
        console.error('📍 Error details:', {
          status: err?.response?.status,
          statusText: err?.response?.statusText,
          data: err?.response?.data,
          url: err?.config?.url,
          method: err?.config?.method,
          headers: err?.config?.headers,
          baseURL: err?.config?.baseURL
        });
        setError(`Failed to load average call handling data: ${err?.response?.status || 'Network error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgId, timeframe]);

  return {
    data,
    loading,
    error,
  };
}; 