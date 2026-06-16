'use client';
import { useState, useEffect } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface Employee {
  id: string;
  name: string;
  avatar: string;
  topics: number;
  modulesStarted: number;
  avgQuizScore: string;
  simulationsDone: number;
  avgScore: string;
}

interface ApiUserStats {
  name: string;
  number_of_topics: number;
  modules_completed: number;
  avg_quiz_score: number;
  simulations_done: number;
  progress_percentage: number;
}

interface UserStatsApiResponse {
  success: boolean;
  message: string;
  data: {
    users: ApiUserStats[];
  };
  total_count: number | null;
}

interface UseEmployeeProgressProps {
  orgId?: string;
  isActive?: boolean;
  timeframe?: string;
  tagId?: string;
}

interface UseEmployeeProgressReturn {
  employees: Employee[] | null;
  loading: boolean;
  error: string | null;
}

export const useEmployeeProgress = ({
  orgId,
  isActive = true,
  timeframe,
  tagId
}: UseEmployeeProgressProps = {}): UseEmployeeProgressReturn => {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
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
          period: timeframe,
          tag_id: tagId === "all" ? "" : tagId
        }).toString();

        const url = `/analytics/user-stats?${queryParams}`;

        const response: {data: UserStatsApiResponse} = await serviceDeskInstance.get(url);
        

        if (response.data.success && response.data.data?.users) {
          // Transform API data to Employee interface
          const transformedEmployees: Employee[] = response.data.data.users.map((user, index) => ({
            id: (index + 1).toString(),
            name: user.name || 'Unknown User',
            avatar: '/api/placeholder/32/32', // Placeholder avatar
            topics: user.number_of_topics || 0,
            modulesStarted: user.modules_completed || 0,
            avgQuizScore: user.avg_quiz_score ? `${(user.avg_quiz_score/10).toFixed(1)}/10` : 'N/A',
            simulationsDone: user.simulations_done || 0,
            avgScore: user.progress_percentage ? `${Math.round(user.progress_percentage)}%` : 'N/A',
          }));


          setEmployees(transformedEmployees);
        } else {
          console.error('❌ Invalid API response:', response.data);
          setError('Invalid API response structure');
        }
      } catch (err: any) {
        console.error('❌ Error fetching employee progress:', err);
        console.error('📍 Error details:', {
          status: err?.response?.status,
          statusText: err?.response?.statusText,
          data: err?.response?.data,
        });
        setError('Failed to load employee progress data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgId, isActive, timeframe, tagId]);

  return {
    employees,
    loading,
    error,
  };
}; 