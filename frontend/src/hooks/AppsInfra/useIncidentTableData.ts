// hooks/useIncidentTableData.ts
import { useState, useEffect, useCallback } from 'react';
import { nocApiInstance } from 'api/common/axiosInstance';
import { Incident } from 'api/sessions'; 

export function useIncidentTableData() {
  const [data, setData] = useState<Incident[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await nocApiInstance.get('/api/v1/incidents');
      setData(res?.data || []);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  return { data, loading, error, refetch: fetchIncidents };
}