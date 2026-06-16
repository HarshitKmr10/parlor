// hooks/usePostcallSummary.ts
import { useEffect, useState } from 'react';
import axios from 'axios';
import { serviceDeskInstance } from '@/api/common/axiosInstance';

export interface SummaryAndSentimentResponse {
  id: string;
  created_at: string; // ISO datetime string
  caller: string;
  ended_reason: string | null;
  details_url: string | null;
  ticket_id: string | null;
  ended_at: string;
  recordingUrl: string;
  status: 'ended' | 'active' | 'failed' | string; // add other statuses as needed
  user_name: string;
  user_sys_id: string;
  called_at: string;
  voice_virtual_agent_id: string | null;
  voice_virtual_agent_call_status: string | null;
  voice_virtual_agent: string | null;
  incident_ticket_ids: string[];
  interaction_id: string | null;
  summary: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  recording_file?: string;
}

export function usePostcallSentiment(meetingId: string) {
  const [data, setData] = useState<SummaryAndSentimentResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meetingId) return;



    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await serviceDeskInstance.get<SummaryAndSentimentResponse>(
          `/service_desk/${meetingId}/get_summary_and_sentiment`
        );
        setData(response.data);
      } catch (err: any) {
        console.error('Failed to fetch summary and sentiment:', err);
        setError(err?.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [meetingId]);

  return { data, loading, error };
}