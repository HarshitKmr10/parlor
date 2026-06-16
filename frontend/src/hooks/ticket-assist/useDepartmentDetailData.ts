'use client';
import { useState, useEffect, useCallback } from 'react';
import { aiAgentInstance } from '../../api/common/axiosInstance';
import { format } from 'date-fns';

export interface DepartmentTicket {
  number: string;
  priority: string;
  state: string;
  short_description: string;
  description: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  department: string;
  type: string;
  type_1?: string;
  caller_id: string;
  assigned_to: string;
  knowledge: string;
  // Add other fields as needed
}

export interface DepartmentDetailResponse {
  error: string | null;
  data: {
    data: {
      value_counts: { [key: string]: number };
      tickets: DepartmentTicket[];
      total_count: number;
      page: number;
      page_size: number;
      total_pages: number;
    };
  };
  meta: any;
}

interface UseDepartmentDetailDataParams {
  departmentName: string | null;
  org_id: string | undefined;
  startDate: Date | null;
  endDate: Date | null;
}

export interface UseDepartmentDetailDataReturn {
  processedData: any | null;
  rawTickets: DepartmentTicket[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const useDepartmentDetailData = ({ 
  departmentName, 
  org_id, 
  startDate, 
  endDate 
}: UseDepartmentDetailDataParams): UseDepartmentDetailDataReturn => {
  const [processedData, setProcessedData] = useState<any | null>(null);
  const [rawTickets, setRawTickets] = useState<DepartmentTicket[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!departmentName || !org_id || !startDate || !endDate) {
      console.warn('Skipping department detail fetch: Missing required parameters');
      setProcessedData(null);
      setRawTickets(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');
    const queryParams = `start_date=${formattedStartDate}&end_date=${formattedEndDate}&department=${encodeURIComponent(departmentName)}&page=1&page_size=1000`;

    try {
      const response = await aiAgentInstance.get<DepartmentDetailResponse>(
        `/ticket-assist/tickets-by-department?${queryParams}`
      );

      
      const tickets = response.data?.data?.data?.tickets || [];
      setRawTickets(tickets);

      // Process tickets by type (similar to category processing)
      const processedByType: { [key: string]: any[] } = {};

      tickets.forEach(ticket => {
        const ticketType = ticket.type ? ticket.type.charAt(0).toUpperCase() + ticket.type.slice(1) : 'Unknown';
        
        if (!processedByType[ticketType]) {
          processedByType[ticketType] = [];
        }

        // Group by short_description (platform/topic)
        const platform = ticket.short_description || 'Unknown Topic';
        
        let existingCard = processedByType[ticketType].find(card => card.platform === platform);
        
        if (!existingCard) {
          existingCard = {
            platform: platform,
            issueCount: 0,
            employeeCount: 0,
            callerIds: new Set(),
            kbStatus: false,
            resolvedTickets: 0,
            totalTtrMilliseconds: 0,
            ttr: 'N/A'
          };
          processedByType[ticketType].push(existingCard);
        }

        existingCard.issueCount++;
        existingCard.callerIds.add(ticket.caller_id);
        
        if (ticket.knowledge === 'true') {
          existingCard.kbStatus = true;
        }

        if (ticket.resolved_at && ticket.created_at) {
          try {
            const createdTime = new Date(ticket.created_at).getTime();
            const resolvedTime = new Date(ticket.resolved_at).getTime();
            if (!isNaN(createdTime) && !isNaN(resolvedTime) && resolvedTime > createdTime) {
              existingCard.totalTtrMilliseconds += (resolvedTime - createdTime);
              existingCard.resolvedTickets++;
            }
          } catch (e) {
            console.warn('Error calculating TTR for ticket:', ticket.number);
          }
        }
      });

      // Calculate final metrics for each card
      Object.values(processedByType).forEach(typeCards => {
        typeCards.forEach(card => {
          card.employeeCount = card.callerIds.size;
          delete card.callerIds; // Remove Set object
          
          if (card.resolvedTickets > 0) {
            const avgTtrHours = card.totalTtrMilliseconds / card.resolvedTickets / (1000 * 60 * 60);
            card.ttr = `${avgTtrHours.toFixed(1)}hr`;
          }
          delete card.totalTtrMilliseconds;
          delete card.resolvedTickets;
        });
      });

      setProcessedData(processedByType);

    } catch (err) {
      console.error("Error fetching department detail data:", err);
      setError(err as Error);
      setProcessedData(null);
      setRawTickets(null);
    } finally {
      setLoading(false);
    }
  }, [departmentName, org_id, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { processedData, rawTickets, loading, error, refetch: fetchData };
};

export default useDepartmentDetailData; 