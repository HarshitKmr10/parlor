import React from 'react';
import { useRouter } from 'next/navigation';
import { Box, Flex, Text } from '@radix-ui/themes';
import Spinner from 'components/spinner/spinner';
import NoDataIcon from 'components/icons/NoDataIcon';

// Define TypeScript interface for the Chat type
interface Chat {
  id: string;
  message: string;
  employeeId: string | null;
  date: string;
}

/**
 * Truncates a message to a specified limit of words.
 * @param message {string} - The message to truncate.
 * @param limit {number} - The maximum number of words to include in the truncated message.
 * @returns {string} - The truncated message.
 */
const truncateMessage = (message: string, limit: number): string => {
  const words = message.split(' ');
  return words.length > limit
    ? `${words.slice(0, limit).join(' ')}...`
    : message;
};

interface AllRecentChatsProps {
  chatHistory: Chat[];
  loading: boolean;
  setSeletedChatId: (chatId: string) => void;
}

function AllRecentChats({ chatHistory, loading, setSeletedChatId }: AllRecentChatsProps) {
  const router = useRouter();

  const handleItemClick = (chatId: string): void => {
    setSeletedChatId(chatId);
    router.push(`/agent-assist?chatId=${chatId}`);
  };

  if (loading) {
    return <Spinner />;
  }

  if (chatHistory.length === 0) {
    return (
      <Box className="h-screen px-2">
        <Flex
          direction="column"
          gapY="2"
          height="100%"
          justify="center"
          align="center"
        >
          <NoDataIcon />
          <Text size="1" align="center" className="text-gray-700 text-balance">
            No chats available
          </Text>
        </Flex>
      </Box>
    );
  }

  return (
    <div className="overflow-y-auto w-full ">
      <Flex p="2" className="w-full items-start" direction="column">
        {chatHistory.map((chat) => (
          <Flex
            onClick={() => handleItemClick(chat.id)}
            key={chat.id}
            p="3"
            className="
              mt-3 first:mt-0 bg-[var(--accent-3)] border-l-5
              border-[var(--accent-11)] cursor-pointer
              gap-1 justify-between w-full items-center
            "
          >
            <Flex direction="column" className="grow">
              <Text size="1" weight="bold">
                {truncateMessage(chat.message, 10)}
              </Text>
              <Text size="1">
                Employee Id:
                {' '}
                {chat.employeeId}
              </Text>
            </Flex>
            <Text size="1" className="max-w-[10ch] text-right">
              {chat.date}
            </Text>
          </Flex>
        ))}
      </Flex>
    </div>
  );
}

export default AllRecentChats;
