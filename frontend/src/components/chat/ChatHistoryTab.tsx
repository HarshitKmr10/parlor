import React, { useState, useEffect } from 'react';
import {
  Button, Tabs, TextField, Box, Flex, Text,
} from '@radix-ui/themes';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import AllRecentChats from 'components/chat/AllRecentChats';
import { HistoryChat } from 'api/chat';
import NoDataIcon from 'components/icons/NoDataIcon';

interface ChatHistoryTabProps {
  chatHistory: HistoryChat[];
  loading: boolean;
  setSeletedChatId: (chatId: string) => void;
}

function ChatHistoryTab({
  chatHistory,
  loading,
  setSeletedChatId,
}: ChatHistoryTabProps) {
  const MAX_NO_OF_CHATS_TO_SHOW_BY_DEFAULT = 6;
  const [showAllChatHistory, setShowAllChatHistory] = useState(false);
  const [searchFieldValue, setSearchFieldValue] = useState('');
  const [filteredChatHistory, setFilteredChatHistory] = useState(chatHistory);

  useEffect(() => {
    if (!chatHistory) return;

    const filtered = chatHistory.filter(
      (chat) => chat.message.toLowerCase().includes(searchFieldValue.toLowerCase())
        || chat.employeeId?.toLowerCase().includes(searchFieldValue.toLowerCase()),
    );
    setFilteredChatHistory(filtered);
  }, [searchFieldValue, chatHistory]);

  const chatHistoryToShow = showAllChatHistory
    ? filteredChatHistory
    : filteredChatHistory.slice(0, MAX_NO_OF_CHATS_TO_SHOW_BY_DEFAULT);

  return (
    <Tabs.Content
      value="chatHistory"
      className="overflow-y-auto w-full flex flex-col items-center"
      style={{ maxHeight: 'calc(100vh - 9.5rem)' }}
    >
      <div className="w-full p-2 ">
        <TextField.Root
          className="w-full "
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchFieldValue(e.target.value)}
          value={searchFieldValue}
          placeholder="Search chats..."
        >
          <TextField.Slot>
            <MagnifyingGlassIcon height="16" width="16" />
          </TextField.Slot>
        </TextField.Root>
      </div>

      {chatHistory && chatHistory.length === 0 ? (
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
        </Box>
      ) : (
        <>
          <AllRecentChats
            chatHistory={chatHistoryToShow}
            loading={loading}
            setSeletedChatId={setSeletedChatId}
          />

          {filteredChatHistory.length > MAX_NO_OF_CHATS_TO_SHOW_BY_DEFAULT && (
            <Button
              className="cursor-pointer mt-3"
              variant="soft"
              onClick={() => setShowAllChatHistory((prev) => !prev)}
            >
              Show
              {' '}
              {showAllChatHistory ? 'Less' : 'All'}
            </Button>
          )}
        </>
      )}
    </Tabs.Content>
  );
}

export default ChatHistoryTab;
