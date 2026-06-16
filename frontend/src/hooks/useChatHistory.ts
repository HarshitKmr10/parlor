import { useState, useEffect } from 'react';
import { useGlobalContext } from 'contexts/store';
import { API } from 'api';
import { HistoryChat } from 'api/chat';

class ChatHistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatHistoryError';
  }
}

export const useChatHistory = () => {
  const { user } = useGlobalContext();
  const [chatHistory, setChatHistory] = useState<HistoryChat[]>([]);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!user) {
        setError(new ChatHistoryError('User information is missing'));
        console.error('Unable to fetch chat history: User information is missing');
        return;
      }

      setChatHistoryLoading(true);
      setError(null);

      try {
        const chats = await API.Meetings.GetHistoryChat(user);

        if (!chats || !Array.isArray(chats)) {
          setError(new ChatHistoryError('Invalid chat history data received'));
          setChatHistory([]);
          return;
        }

        setChatHistory(chats);
      } catch (err) {
        console.error('Error fetching chat history:', err);
        setError(new ChatHistoryError(`Failed to fetch chat history: ${err instanceof Error ? err.message : 'Unknown error'}`));
        setChatHistory([]);
      } finally {
        setChatHistoryLoading(false);
      }
    };

    fetchChatHistory();
  }, []);

  return { chatHistory, chatHistoryLoading, error };
};
