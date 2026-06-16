'use client';
import { useState, useEffect, useCallback } from 'react';
import { aiAgentInstance } from '../../api/common/axiosInstance';
import { EmployeePersona } from '../../components/TicketAssistDashboard/TopFilterBar';
import { format } from 'date-fns';

export interface EmployeeDepartmentsResponse {
  error: string | null;
  data: {
    data: {
      value_counts: { [key: string]: number };
      tickets: any[];
      total_count: number;
      page: number;
      page_size: number;
      total_pages: number;
    };
  };
  meta: any;
}

export interface UseEmployeeDepartmentsReturn {
  employeePersonas: EmployeePersona[];
  loading: boolean;
  error: any;
  refetch: () => Promise<void>;
}

export function useEmployeeDepartments(org_id: string | undefined, startDate: Date | null, endDate: Date | null): UseEmployeeDepartmentsReturn {
  const [employeePersonas, setEmployeePersonas] = useState<EmployeePersona[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  const fetchData = useCallback(async () => {
    if (!org_id || !startDate || !endDate) {
      console.warn('Skipping employee departments fetch: Missing org_id or dates');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');
    const queryParams = `start_date=${formattedStartDate}&end_date=${formattedEndDate}&department=All&page=1&page_size=1000`;

    try {
      const response = await aiAgentInstance.get<EmployeeDepartmentsResponse>(
        `/ticket-assist/tickets-by-department?${queryParams}`
      );
      const valueCounts = response.data?.data?.data?.value_counts || {};
      
      if (Object.keys(valueCounts).length === 0) {
        console.warn("No departments returned from API.");
        setEmployeePersonas([{ name: 'All Employees', issues: 0 }]);
        setLoading(false);
        return;
      }

      // Process departments and handle empty/null department names
      let othersCount = 0;
      let totalIssues = 0;
      const combinedPersonas: EmployeePersona[] = [];

      Object.entries(valueCounts).forEach(([department, count]) => {
        totalIssues += count;
        
        // If department is empty, null, or whitespace, add to "Others"
        if (!department || department.trim() === '') {
          othersCount += count;
        } else {
          // Format department name properly
          const formattedName = department.charAt(0).toUpperCase() + department.slice(1);
          combinedPersonas.push({
            name: formattedName,
            issues: count,
          });
        }
      });

      // Add "Others" if there are tickets with empty/null departments
      if (othersCount > 0) {
        combinedPersonas.push({
          name: 'Others',
          issues: othersCount,
        });
      }

      // Sort by issue count (descending)
      combinedPersonas.sort((a, b) => b.issues - a.issues);

      // Add "All Employees" at the beginning
      combinedPersonas.unshift({
        name: 'All Employees',
        issues: totalIssues,
      });

      setEmployeePersonas(combinedPersonas);

    } catch (err) {
      console.error("Error fetching employee departments:", err);
      setError(err);
      // Just show All Employees with 0 issues on error
      setEmployeePersonas([{ name: 'All Employees', issues: 0 }]);
    } finally {
      setLoading(false);
    }
  }, [org_id, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { employeePersonas, loading, error, refetch: fetchData };
} 