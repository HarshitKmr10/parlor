'use client';
import { useState, useEffect, useCallback } from 'react';
import { aiAgentInstance } from '../../api/common/axiosInstance'; // Adjust path as needed
import { format } from 'date-fns';

// Interface for the data structure expected by the PieChart component
export interface IssueTypeVolumeData {
  name: string;
  value: number;
}

// Interface for the API response structure
interface TicketsByTypeResponse {
  error: string | null;
  data: {
    data: {
      value_counts: { [key: string]: number };
      tickets: any[]; // We don't need the tickets array detail here
    };
  };
  meta: any;
}

export function useIssueTypeVolume(org_id: string | undefined, startDate: Date | null, endDate: Date | null) {
  const [data, setData] = useState<IssueTypeVolumeData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  // --- Define fetchData using useCallback --- 
  const fetchData = useCallback(async () => {
    if (!org_id || !startDate || !endDate) {
      console.warn('Skipping issue type volume fetch: Missing org_id or dates');
      setLoading(false); 
      return;
    }

    setLoading(true);
    setError(null);

    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');
    const params = `start_date=${formattedStartDate}&end_date=${formattedEndDate}`;

    try {
      const response = await aiAgentInstance.get<TicketsByTypeResponse>(`/ticket-assist/tickets-by-type?${params}`);
      const valueCounts = response.data?.data?.data?.value_counts || {};

      // Transform the value_counts object into an array for the chart
      const transformedData = Object.entries(valueCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize first letter
        value: value,
      }));

      // TODO: Consider sorting the data (e.g., by value descending) if needed for consistent color mapping
      // transformedData.sort((a, b) => b.value - a.value);

      setData(transformedData);

    } catch (err) {
      console.error("Error fetching issue type volume:", err);
      setError(err);
      setData([]); // Set empty data on error
    } finally {
      setLoading(false);
    }
  }, [org_id, startDate, endDate]); // Dependencies for useCallback

  // --- useEffect for initial fetch --- 
  useEffect(() => {
    fetchData();
  }, [fetchData]); // Run when fetchData function reference changes

  // --- Return refetch function --- 
  return { data, loading, error, refetch: fetchData };
} 