// hooks/useIncidentSessionsData.ts
import { useState, useEffect, useCallback } from 'react';
import { nocApiInstance } from 'api/common/axiosInstance';

export interface AppDetails {
  id: string;
  name: string;
  description: string;
  org_id: string;
  config: {
    agents: {
      type: string;
      agentName: string;
    };
    integrations: string[];
    knowledgeSources: string[];
  };
  created_at: string;
  updated_at: string;
  appRoles: any[];
}

export interface IncidentSession {
  id: string;
  appId: string;
  orgId: string;
  name: string;
  sessionType: string;
  createdAt: string;
  relatedRecordType: string | null;
  relatedRecordId: string | null;
  app: AppDetails;
  subChats: any;
  pinnedSessionItems: any;
  artifacts: any;
  documents: any;
  postMortems: any;
  sessionIntegrations: any;
}

export function useIncidentSessionsData(incidentId: string | null) {
  const [data, setData] = useState<IncidentSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!incidentId) return;

    setLoading(true);
    try {
      const res = await nocApiInstance.get<IncidentSession[]>(
        `/api/v1/sessions/related_record_id/${incidentId}`
      );
      setData(res.data || []);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { data, loading, error, refetch: fetchSessions };
}