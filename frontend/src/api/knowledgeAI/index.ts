import { serviceDeskInstance } from "api/common/axiosInstance";

type MeetingData = {
  link: string;
  bot_name: string;
  title: string;
  app_id: string;
  channel: string;
  postcall_analysis_webhook: string;
  team_id: string;
};

export const KnowledgeAI = {

  async createKnowledgeAIMeeting(meetingData: MeetingData): Promise<any> {
    try {
      const response = await serviceDeskInstance.post(
        `/meetings/create_meeting`,
        meetingData
      );
      return response.data;
    } catch (error) {
      console.error("There was an error creating meeting");
      throw error;
    }
  },

  async removeKnowledgeAIMeeting(meetingId: string): Promise<any> {
    try {
      const response = await serviceDeskInstance.post(`/meetings/remove_bot/${meetingId}`);
      return response.data;
    } catch (error) {
      console.error("There was an error removing meeting");
      throw error;
    }
  },

  async getKnowledgeAIMeetingAnalytics(teamId: string): Promise<any> {
    try {
      // Construct the URL with query parameters
      const url = `/knowledge_ai_meeting_analytics/${teamId}`;
      // Make the API call using Axios
      const response = await serviceDeskInstance.get(url);
      if (response.status !== 200) {
        throw new Error(`API request failed: ${response.status}`);
      }
      return response.data;
    } catch (error) {
      console.error("There was an error fetching meeting analytics");
    }
  },
  async getKBforTransitionMeeting(meetingId: string): Promise<any> {
    try {
      const url = `/service_desk/${meetingId}/get_kb_for_transition_meeting`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch KB for transition meeting");
      }
      return response;
      // const response = await serviceDeskInstance.get(url);
      // if (response.status !== 200) {
      //   throw new Error(`API request failed: ${response.status}`);
      // }
      return response;
    } catch (error) {
      console.error("There was an error fetching meeting analytics");
    }
  },
  async getKBQuizforTransitionMeeting(meetingId: string): Promise<any> {
    try {
      const url = `/service_desk/${meetingId}/get_kb_quiz`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch KB Quiz");
      }
      return response;
      // const response = await serviceDeskInstance.get(url);
      // if (response.status !== 200) {
      //   throw new Error(`API request failed: ${response.status}`);
      // }
      return response;
    } catch (error) {
      console.error("There was an error fetching meeting analytics");
    }
  },
  async getKnowledgeJournal(userId: string): Promise<any> {
    try {
      const url = `/service_desk/${userId}/get_knowledge_journal`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch Knowledge Journal");
      }
      return response;
      //   const response = await serviceDeskInstance.get(url);
      //   if (response.status !== 200) {
      //     throw new Error(`API request failed: ${response.status}`);
      //   } 
      //   return response;
    } catch (error) {
      console.error("There was an error fetching meeting analytics");
    }
  },
};
