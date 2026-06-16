import { coPilotInstance, serviceDeskInstance } from 'api/common/axiosInstance';

export type VoiceAgentCalls = {
  id: string;
  created_at?: string;
  caller?: string;
  ended_reason: string;
  details_url?: string;
  ticket_id?: string;
  ended_at?: string;
  incident_ticket_ids?: string[];
  status?: string;
  recordingUrl?: string;
  user_name?: string;
  user_sys_id?: string;
  called_at?: string;
  summary?: string; // JSON string with issue_summary, customer_details, etc.
  sentiment?: string;
  queries?: any;
  reported_issue?: any;
  voice_virtual_agent_id?: string | null;
  voice_virtual_agent_call_status?: string | null;
  voice_virtual_agent?: any | null;
  interaction_id?: string | null;
};

export type VoiceAgentsTranscript = {
  id: string;
  created_at?: string;
  call_id?: string;
  role: string;
  content_type?: string;
  content?: any;
};
export type VoiceAgents = {
  id: string;
  name?: string;
  created_at?: string;
  org_id?: string;
  config: string;
  phone_number?: string;
};

export const VoiceVirtualCalls = {
  GetCalls: async (org_id: string, access_token: string): Promise<VoiceAgentCalls[]> => {
    try {
      const response = await serviceDeskInstance.get<VoiceAgentCalls[]>(
        `/service_desk/${org_id}/voice_virtual_agent_calls`
      );

      const { data } = response;
      return data;
    } catch (err) {
      console.error('There was an error fetching meetings');
    }
  },
  
  GetMeetingById: async (meeting_id: string, access_token: string): Promise<any> => {
    try {
      const response = await coPilotInstance.get(
        `/meetings/vcp_meeting_by_id?meeting_id=${meeting_id}`
      );

      const { data } = response;
      return data;
    } catch (err) {
      console.error('There was an error fetching meeting by ID:', err);
      throw err;
    }
  },
  GetTranscripts: async (
    meeting_id: string,
    access_token: string,
  ): Promise<VoiceAgentsTranscript[]> => {
    try {
      const response = await serviceDeskInstance.get<VoiceAgentsTranscript[]>(
        `/service_desk/${meeting_id}/get_real_time_transcript`
      );

      const { data } = response;
      return data;
    } catch (err) {
      console.error('There was an error fetching meetings');
    }
  },
  GetAgents: async (org_id: string, access_token: string): Promise<VoiceAgents[]> => {
    try {
      const response = await serviceDeskInstance.get<VoiceAgents[]>(
        `/service_desk/${org_id}/voice_virtual_agents_by_organization`
      );

      const { data } = response;
      return data;
    } catch (err) {
      console.error('There was an error fetching meetings');
    }
  },
  GetSummaryAndSentiment: async (
    meeting_id: string,
    access_token: string,
  ): Promise<{ summary: string; sentiment: string } | { message: string }> => {
    try {
      const response = await serviceDeskInstance.get(
        `/service_desk/${meeting_id}/get_summary_and_sentiment`
      );

      const { data } = response;
      return data;
    } catch (err) {
      console.error('There was an error fetching summary and sentiment:', err);
      throw err;
    }
  },
};
