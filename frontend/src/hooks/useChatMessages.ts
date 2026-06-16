import { useState, useCallback } from 'react';
import { useGlobalContext } from 'contexts/store';
import { API } from 'api';

import { parseMessage } from 'utils/apiUtils';

export const useChatMessages = (
  chatID: string | null,
  fetchUserByEmployeeId: (employeeId: string) => Promise<void>,
) => {
  const { user } = useGlobalContext();
  const [chatMessages, setChatMessages] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);

  const fetchChatMessages = useCallback(
    async (chatId = chatID) => {
      if (!chatId) return;
      if (!user) {
        console.warn('User is not available, cannot fetch chat messages');
        return;
      }
      setLoadingChat(true);
      try {
        const chatData = await API.AgentChat.getAgentMessages(chatId, user);
        const parsedMessages = chatData
          .map(parseMessage)
          .filter((message) => message !== null);
        setChatMessages(parsedMessages);
        const lastMessage = chatData[chatData.length - 1];
        if (lastMessage && lastMessage.employee_id) {
          await fetchUserByEmployeeId(lastMessage.employee_id);
        }
      } catch (error) {
        console.error('Error fetching chat messages:', error);
        // console.error(`Error fetching chat messages: ${error}`);
      } finally {
        setLoadingChat(false);
      }
    },
    [chatID, user, fetchUserByEmployeeId],
  );

  return {
    chatMessages,
    loadingChat,
    fetchChatMessages,
    setChatMessages,
  };
};
