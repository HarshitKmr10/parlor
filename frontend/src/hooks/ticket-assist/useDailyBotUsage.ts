'use client';
import { useState, useEffect, useCallback } from 'react';
import { aiAgentInstance } from '../../api/common/axiosInstance'; // Adjust path if needed
import { format, parseISO } from 'date-fns';

// Interface for the transformed data structure expected by the chart
export interface DailyBotUsageData {
  date: string; // Formatted date (e.g., "MM/dd")
  rate: number; // Calculated adaptation rate percentage
}

// Interface for the API response structure
interface DailyBotUsageApiResponse {
  error: string | null;
  data: {
    data: {
      [dateKey: string]: { // Date in "YYYY-MM-DD" format
        "G.Bot": number;
        "Others": number;
      };
    };
  };
  meta: any;
}

export function useDailyBotUsage(org_id: string | undefined, startDate: Date | null, endDate: Date | null) {
  const [data, setData] = useState<DailyBotUsageData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  // --- Define fetchData using useCallback --- 
  const fetchData = useCallback(async () => {
    if (!org_id || !startDate || !endDate) {
      console.warn('Skipping daily bot usage fetch: Missing org_id or dates');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');
    const params = `start_date=${formattedStartDate}&end_date=${formattedEndDate}`;

    try {
      const response = await aiAgentInstance.get<DailyBotUsageApiResponse>(`/ticket-assist/tickets-by-daily-bot-usage?${params}`);
      const dailyData = response.data?.data?.data || {};

      const transformedData = Object.entries(dailyData)
        .map(([dateKey, counts]) => {
          const gBotCount = counts["G.Bot"] || 0;
          const othersCount = counts["Others"] || 0;
          const total = gBotCount + othersCount;
          const rate = total > 0 ? (gBotCount / total) * 100 : 0; 

          return {
            date: format(parseISO(dateKey), 'MM/dd'), 
            rate: parseFloat(rate.toFixed(1)), 
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date)); 

      setData(transformedData);

    } catch (err) {
      console.error("Error fetching daily bot usage:", err);
      setError(err);
      setData([]); 
    } finally {
      setLoading(false);
    }
  }, [org_id, startDate, endDate]); 
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
} 