import { useEffect, useState } from 'react';
import { getIncidentAnalysis } from 'api/appsInfra';

type AnalysisType = {
  past_incident_details: any;
  change_requests: any;
  impact_analysis: string;
};

export const useIncidentAnalysis = (incidentId: string) => {
  const [analysis, setAnalysis] = useState<AnalysisType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!incidentId) return;

    const fetchAnalysis = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getIncidentAnalysis(incidentId);
        setAnalysis(data);
      } catch (err: any) {
        console.error('Failed to fetch incident analysis:', err);
        setError(err?.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [incidentId]);

  return { analysis, loading, error };
};