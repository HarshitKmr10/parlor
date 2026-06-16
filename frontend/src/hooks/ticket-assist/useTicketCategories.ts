'use client';
import { useState, useEffect, useCallback } from 'react';
import { aiAgentInstance } from '../../api/common/axiosInstance'; // Adjust path as needed
import { IssueCategory } from '../../components/TicketAssistDashboard/TopFilterBar'; // Import interface
import { format } from 'date-fns';
import { ApiTicket } from '../useCategoryDetailData'; // Assuming ApiTicket is defined and suitable

export interface TicketCategoriesResponse {
  error: string | null;
  data: {
    data: string[];
  };
  meta: any;
}

// This response is from /tickets-by-category when no specific category is given
export interface AllTicketDataResponse {
  error: string | null;
  data: {
    data: {
      value_counts: { [key: string]: number };
      tickets: ApiTicket[]; // <-- The tickets array we want
    };
  };
  meta: any;
}

// Updated return type for the hook
export interface UseTicketCategoriesReturn {
  categories: IssueCategory[];
  allTicketsFromCategoryEndpoint: ApiTicket[]; // New: to expose all tickets
  loading: boolean;
  error: any;
  refetch: () => Promise<void>;
}

export function useTicketCategories(org_id: string | undefined, startDate: Date | null, endDate: Date | null): UseTicketCategoriesReturn {
  const [categories, setCategories] = useState<IssueCategory[]>([]);
  const [allTicketsFromCategoryEndpoint, setAllTicketsFromCategoryEndpoint] = useState<ApiTicket[]>([]); // New state
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  const fetchData = useCallback(async () => {
    if (!org_id || !startDate || !endDate) {
      console.warn('Skipping category list fetch: Missing org_id or dates');
      setCategories([{ name: 'All Categories', issues: 0 }]);
      setAllTicketsFromCategoryEndpoint([]); // Reset
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setAllTicketsFromCategoryEndpoint([]); // Reset on new fetch

    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');
    
    const queryParams = new URLSearchParams({
        start_date: formattedStartDate,
        end_date: formattedEndDate,
    }).toString();

    try {
      const listRes = await aiAgentInstance.get<TicketCategoriesResponse>(`/ticket-assist/get-list-of-ticket-categories?${queryParams}`);
      const categoryNamesFromApi = listRes.data?.data?.data || [];
      if (categoryNamesFromApi.length === 0) {
        setCategories([{ name: 'All Categories', issues: 0 }]);
        setAllTicketsFromCategoryEndpoint([]);
        setLoading(false);
        return;
      }

      // Fetch all tickets and their value_counts (when no specific category is given to tickets-by-category)
      const allTicketsRes = await aiAgentInstance.get<AllTicketDataResponse>(`/ticket-assist/tickets-by-category?${queryParams}`);
      const apiData = allTicketsRes.data?.data?.data;
      const categoryCounts = apiData?.value_counts || {};
      const fetchedTickets = apiData?.tickets || []; // Get the tickets

      setAllTicketsFromCategoryEndpoint(fetchedTickets); // Store all fetched tickets

      let totalIssues = 0;
      const combinedCategories: IssueCategory[] = categoryNamesFromApi.map(name => {
        const count = categoryCounts[name.toLowerCase()] || categoryCounts[name] || 0; 
        totalIssues += count;
        return {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          issues: count,
        };
      });

      combinedCategories.unshift({
        name: 'All Categories',
        issues: totalIssues,
      });

      setCategories(combinedCategories);

    } catch (err) {
      console.error("Error fetching ticket categories or their counts:", err);
      setError(err);
      setCategories([{ name: 'All Categories', issues: 0 }]); 
      setAllTicketsFromCategoryEndpoint([]);
    } finally {
      setLoading(false);
    }
  }, [org_id, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { categories, allTicketsFromCategoryEndpoint, loading, error, refetch: fetchData };
} 