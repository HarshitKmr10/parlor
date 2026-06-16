import { serviceDeskInstance } from "api/common/axiosInstance";

export type ChatVirtualConversation = {
  id: string;
  session_id?: string;
  messages?: any;
  language?: string;
  file_attachments?: string;
  channel_id?: string;
  from_id?: string;
  created_at?: string;
  updated_at?: string;
  conversation_id?: string;
  interaction_id?: string;
  tasks?: string;
  status?: string;
  user_details?: UserDetails;
};
type UserDetails = {
  user_name: string;
  user_id: string;
  service_url: string;
  azure_object_id: string;
};

export const ChatVirtualCalls = {
  GetConversations: async (
    org_id: string
  ): Promise<ChatVirtualConversation[]> => {
    try {
      const response = await serviceDeskInstance.get<ChatVirtualConversation[]>(
        `/service_desk/${org_id}/get_all_chat_virtual_agent_conversations`
      );
      return response.data;
    } catch (err) {
      console.error("There was an error fetching meetings");
    }
  },
};
