import { useState, useEffect, useCallback } from 'react';
import { format, formatDistanceStrict, parseISO } from 'date-fns'; // Added format, parseISO for consistency if needed for dates
import { aiAgentInstance } from '../api/common/axiosInstance'; // Assuming this path is correct

// Placeholder types - these will be refined based on CategoryDetailBoard's needs
// and the transformation logic we implement.
interface CategoryCardData {
  platform: string; // Derived from ticket data (e.g., short_description, tags, cmdb_ci)
  issueCount: number;
  employeeCount: number;
  kbStatus: boolean; // Derived from 'knowledge' field
  ttr: string | null; // Calculated Time To Resolution
}

type CategoryDetailData = Record<string, CategoryCardData[]>; // Keyed by issue type (e.g., "Troubleshoot")

interface UseCategoryDetailDataProps {
  categoryName: string | null;
  org_id: string | undefined;
  startDate: Date | null;
  endDate: Date | null;
}

interface UseCategoryDetailDataReturn {
  processedData: CategoryDetailData | null;
  rawTickets: ApiTicket[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Represents a single ticket from the API response
export interface ApiTicket {
  number: string;
  short_description: string;
  description?: string; // Optional
  tags?: string[]; // Optional array of tags
  type: string; // e.g., 'troubleshoot', 'fix'
  type_1?: string; // e.g., 'troubleshoot', 'fix'
  caller_id: string; // Employee identifier
  knowledge: string; // 'true' or 'false' as string
  created_at: string; // ISO date string
  resolved_at: string | null; // ISO date string or null
  cmdb_ci?: string; // Optional CI
  assigned_to?: string; // Optional assigned to
  // Add other potentially relevant fields from the API if needed
}

// Updated to match expected structure from aiAgentInstance response
// Assuming the actual data payload is nested under response.data.data.data
interface TicketApiResponse {
  error: any; // Or a more specific error type if known
  data: {
    data: { // This matches the structure seen in useDailyBotUsage
      // value_counts might not be present in this specific endpoint, or its structure might differ
      // value_counts?: Record<string, number>; 
      tickets: ApiTicket[];
    };
    // meta?: any; // Include if meta is expected
  };
}

// Helper function to derive platform/topic from ticket data
// TODO: Refine this logic based on actual data patterns and desired grouping
const derivePlatform = (ticket: ApiTicket): string => {
  // Simple initial strategy: Use short description, fallback to description or 'Unknown'
  // Could also check tags, cmdb_ci, etc.
  return ticket.short_description || ticket.description || 'Unknown Topic';
};

// Helper function to calculate TTR (simplified)
// TODO: Implement more robust TTR calculation if needed (handle business hours, etc.)
const calculateTtr = (createdAt: string, resolvedAt: string | null): string | null => {
  if (!resolvedAt) {
    return null; // Or return 'Pending' or calculate time since creation
  }
  try {
    const start = new Date(createdAt);
    const end = new Date(resolvedAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    // Provides a human-readable duration like '4 hours', '2 days'
    return formatDistanceStrict(end, start);
  } catch (e) {
    console.error("Error calculating TTR:", e);
    return null;
  }
};

// Main processing function
const processCategoryTickets = (tickets: ApiTicket[]): CategoryDetailData => {
  const groupedData: Record<string, Record<string, { 
      cardData: Omit<CategoryCardData, 'employeeCount'>; 
      employees: Set<string>; 
    }
  >> = {};

  tickets.forEach(ticket => {
    const type = ticket?.type_1?.charAt(0).toUpperCase() + ticket?.type_1?.slice(1); // Capitalize (e.g., Troubleshoot)
    const platform = derivePlatform(ticket);

    if (!type || !platform) return; // Skip if essential data is missing

    // Initialize type group if it doesn't exist
    if (!groupedData[type]) {
      groupedData[type] = {};
    }

    // Find or create platform entry within the type group
    if (!groupedData[type][platform]) {
      groupedData[type][platform] = {
        cardData: {
          platform: platform,
          issueCount: 0,
          kbStatus: ticket.knowledge === 'true', // Convert string to boolean
          ttr: calculateTtr(ticket.created_at, ticket.resolved_at), // Calculate TTR
        },
        employees: new Set<string>(),
      };
    }

    // Update counts and employee set
    groupedData[type][platform].cardData.issueCount += 1;
    groupedData[type][platform].employees.add(ticket.caller_id);
  });

  // Convert the intermediate structure to the final CategoryDetailData format
  const finalData: CategoryDetailData = {};
  Object.keys(groupedData).forEach(type => {
    finalData[type] = Object.values(groupedData[type]).map(platformGroup => ({
      ...platformGroup.cardData,
      employeeCount: platformGroup.employees.size,
    }));
  });

  return finalData;
};

const useCategoryDetailData = ({ 
    categoryName, 
    org_id, // Keep org_id as a prop in case other parts of the hook/logic (not the URL) might need it, or if aiAgentInstance uses it implicitly.
    startDate, 
    endDate 
}: UseCategoryDetailDataProps): UseCategoryDetailDataReturn => {
  const [processedData, setProcessedData] = useState<CategoryDetailData | null>(null);
  const [rawTickets, setRawTickets] = useState<ApiTicket[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!categoryName || !org_id || !startDate || !endDate) {
      setProcessedData(null); 
      setRawTickets(null);
      setError(null);
      setLoading(false);
      console.warn('Skipping category detail fetch: Missing categoryName, org_id, or dates');
      return;
    }

    setLoading(true);
    setError(null);
    setProcessedData(null); 
    setRawTickets(null);

    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');
    
    const params = new URLSearchParams({
        category: categoryName.toLowerCase(), 
        start_date: formattedStartDate,
        end_date: formattedEndDate,
    }).toString();

    const apiUrl = `/ticket-assist/tickets-by-category?${params}`;

    try {
      const response = await aiAgentInstance.get<TicketApiResponse>(apiUrl);
      const rawApiResponse = response.data;

      if (rawApiResponse.error) { 
        throw new Error(`API Error: ${JSON.stringify(rawApiResponse.error)}`);
      }
      
      const fetchedTickets = rawApiResponse.data?.data?.tickets; 
      if (!fetchedTickets) {
          throw new Error('Invalid API response structure: tickets array not found.');
      }

      setRawTickets(fetchedTickets);

      const processedTicketData = processCategoryTickets(fetchedTickets);
      setProcessedData(processedTicketData); 

    } catch (err: any) {
      console.error("Failed to fetch or process category detail data:", err);
      const errorMessage = err.response?.data?.error || err.message || 'An unknown error occurred';
      setError(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  }, [categoryName, org_id, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { processedData, rawTickets, loading, error, refetch: fetchData };
};

export default useCategoryDetailData; 