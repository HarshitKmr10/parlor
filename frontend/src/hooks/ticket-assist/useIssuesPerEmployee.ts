import { useState, useEffect, useCallback } from 'react';
import { aiAgentInstance } from '../../api/common/axiosInstance'; 
import { format } from 'date-fns';

export interface IssuesPerEmployeeData {
  value: number | null;
  change: number | null; 
}

interface ApiIssuesPerEmployeeCallerBreakdownResponse {
  error: string | null;
  data?: {
    tickets_per_employee?: { [callerName: string]: number }; 
    total_tickets?: number;
  };
  meta?: any;
}

export function useIssuesPerEmployee(org_id: string | undefined, startDate: Date | null, endDate: Date | null) {
  const [data, setData] = useState<IssuesPerEmployeeData>({ value: null, change: null });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  const fetchData = useCallback(async () => {
    if (!org_id || !startDate || !endDate) {
      setData({ value: null, change: null });
      setLoading(false);
      console.warn('Skipping Issues Per Employee fetch: Missing org_id or dates.');
      return;
    }
    setLoading(true);
    setError(null);

    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');
    
    const params = new URLSearchParams({
        start_date: formattedStartDate,
        end_date: formattedEndDate,
        caller_id: 'All', 
    }).toString();

    try {
      const response = await aiAgentInstance.get<ApiIssuesPerEmployeeCallerBreakdownResponse>(
        `/ticket-assist/tickets-per-employee?${params}`
      );
      const apiData = response.data?.data;

      let calculatedIpe: number | null = null;
      if (apiData?.total_tickets && apiData?.tickets_per_employee) {
        const uniqueEmployeeCount = Object.keys(apiData.tickets_per_employee).length;
        if (uniqueEmployeeCount > 0) {
          calculatedIpe = apiData.total_tickets / uniqueEmployeeCount;
        }
      }
      
      setData({
        value: calculatedIpe,
        change: null,
      });

    } catch (err) {
      console.error("Error fetching issues per employee (caller breakdown):", err);
      setError(err);
      setData({ value: null, change: null });
    } finally {
      setLoading(false);
    }
  }, [org_id, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
} 