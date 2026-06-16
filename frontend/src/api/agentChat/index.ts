import { coPilotInstance } from 'api/common/axiosInstance';
import { AgentAssistMessageType, UserType } from 'types/common';


export const AgentChat = {
  async saveAgentMessage(
    message: string | null,
    agent_assist_id: string | null,
    user: UserType,
    message_id: string | null,
    employee_id: string | null = null,
    chat_title: string | null = null,
  ): Promise<void> {
    try {
      // Add null check for user to prevent TypeError
      if (!user || !user.org_id) {
        console.warn('User or user.org_id is not available, skipping chat save');
        return;
      }

      // Construct the URL with query parameters
      let url = `/meetings/${agent_assist_id}/insert_agent_chats?message=${encodeURIComponent(
        message,
      )}&title=${encodeURIComponent(chat_title)}&org_id=${encodeURIComponent(
        user.org_id,
      )}&message_id=${encodeURIComponent(message_id)}`;

      // Append the employee_id to the URL query string if it's not null
      if (employee_id !== null) {
        url += `&employee_id=${encodeURIComponent(employee_id)}`;
      }

      // Make the API call using Axios
      await coPilotInstance.post(url);
    } catch (error) {
      console.error('There was an error saving chat message');
    }
  },

  async getAgentMessages(
    chatID: string,
    user: UserType,
  ): Promise<AgentAssistMessageType[]> {
    // Add null check for user to prevent potential issues
    if (!user) {
      console.warn('User is not available, cannot fetch agent messages');
      return [];
    }

    const url = `/meetings/${chatID}/agent_chats`;
    try {
      // Fetch chat data
      const response = await coPilotInstance.get(url);
      const chatData = response.data;
      return chatData.data.sort(
        (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
      );
    } catch (error) {
      console.error('Failed to fetch chat messages');
      return [];
    }
  },
};
