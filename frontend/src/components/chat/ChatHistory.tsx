import React, { useState } from 'react';
import {
  Button, Box, Text, Flex,
} from '@radix-ui/themes';
import { formatDate } from 'utils/dateUtils';
import NoDataIcon from 'components/icons/NoDataIcon';
import { truncateMessage } from 'utils/stringUtils';

interface ChatHistoryItem {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
}

interface ChatHistoryProps {
  chatHistory: ChatHistoryItem[];
  loading: boolean;
  onChatSelect: (chatId: string) => void;
}

const MAX_NO_OF_CHATS_TO_SHOW_BY_DEFAULT = 6;

function ChatHistory({ chatHistory, loading, onChatSelect }: ChatHistoryProps) {
  const [showAllChatHistory, setShowAllChatHistory] = useState<boolean>(false);

  const chatHistoryToShow = showAllChatHistory
    ? chatHistory
    : chatHistory.slice(0, MAX_NO_OF_CHATS_TO_SHOW_BY_DEFAULT);

  if (loading) {
    return <Text>Loading chat history...</Text>;
  }

  if (chatHistory.length === 0) {
    <Box className="h-[100vh] px-2">
      <Flex
        direction="column"
        gapY="2"
        height="100%"
        justify="center"
        align="center"
      >
        <NoDataIcon />
        <Text
          size="1"
          align="center"
          className="text-gray-700 text-balance"
        >
          No chat history available.
        </Text>
      </Flex>
    </Box>;
  }

  return (
    <Box className="w-full">
      {chatHistoryToShow.map((chat) => (
        <Flex
          key={chat.id}
          direction="column"
          className="border-b border-gray-200 p-3 cursor-pointer hover:bg-gray-100"
          onClick={() => onChatSelect(chat.id)}
        >
          <Text size="2" weight="bold">
            {chat.title}
          </Text>
          <Text size="1" className="text-gray-500">
            {truncateMessage(chat.lastMessage, 10)}
          </Text>
          <Text size="1" className="text-gray-400">
            {formatDate(chat.timestamp)}
          </Text>
        </Flex>
      ))}
      {chatHistory.length > MAX_NO_OF_CHATS_TO_SHOW_BY_DEFAULT && (
        <Button
          className="mt-3 w-full cursor-pointer"
          variant="soft"
          onClick={() => setShowAllChatHistory((prev) => !prev)}
        >
          Show
          {' '}
          {!showAllChatHistory ? 'All' : 'Less'}
        </Button>
      )}
    </Box>
  );
}

export default ChatHistory;
