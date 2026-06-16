// VoiceVirtualCallItem.tsx

import React from 'react';
import moment from 'moment';
import {
  Box, Card, Flex, Text,
} from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import CustomAvatar from 'components/CustomAvatar';
import { VoiceAgentCalls } from 'api/voiceVirtualAgent';
import { ChatVirtualConversation } from 'api/chatVirtualAgent';

interface ChatVirtualItemProps {
  conversation: ChatVirtualConversation;
  onSelect: (conversation: ChatVirtualConversation) => void;
  isSelected: boolean;
}

function ChatVirtualItem({
  conversation,
  onSelect,
  isSelected,
}: ChatVirtualItemProps) {
  const { t } = useTranslation();
  const conversationDate = moment(conversation.created_at);
  const formattedDate = conversationDate.format('ddd, D MMMM,');
  const startTime = conversationDate.format('hh:mm A');

  return (
    <div className="relative">
      <Box m="3">
        <Card
          onClick={() => onSelect(conversation)}
          onKeyDown={(e) => e.key === 'Enter' && onSelect(conversation)}
          variant="ghost"
          className={`cursor-pointer  ${isSelected ? 'bg-[var(--accent-3)]' : ''}`}
        >
          <Flex gap="2" align="center" justify="between">
            <Flex align="center" gap="2">
              <Box position="relative">
                <CustomAvatar alt="image" src={null} name={conversation.user_details?.user_name} />
                {conversation.status === 'ongoing' && (
                <div
                  className="absolute right-0 bottom-0 bg-green-500 h-3 w-3 rounded-full"
                  style={{ boxShadow: '0 0 5px 3px rgba(34, 197, 94, 0.4)' }}
                />
                )}
              </Box>
              <Box>
                <Text as="div" size="2" weight="bold" className={isSelected ? 'text-[var(--accent-11)]' : ''}>
                  {conversation.user_details?.user_name || t('chat_virtual_agent.unknownUser')}
                </Text>
                <Text as="div" size="1" color="gray">
                  {`${conversation.user_details?.azure_object_id?.slice(0, 8)}...${conversation.user_details?.azure_object_id?.slice(-8)}`}
                </Text>
              </Box>
            </Flex>
            <Box>
              <Text as="div" size="1" color="gray">
                {formattedDate}
              </Text>
              <Text as="div" size="1" color="gray" align="right">
                {startTime}
              </Text>
            </Box>
          </Flex>
        </Card>
      </Box>
      <div className="border-b border-gray-200 mt-2 " />
    </div>
  );
}

export default React.memo(ChatVirtualItem);
