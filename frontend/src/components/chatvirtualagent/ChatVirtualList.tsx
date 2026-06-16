'use client';

import React, { useState, useCallback } from 'react';
import { Box, Flex, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { ChatVirtualConversation } from 'api/chatVirtualAgent';
import ChatVirtualItem from './ChatVirtualItem';

interface ChatVirtualListProps {
  conversations: ChatVirtualConversation[];
  onSelect: (conversation: ChatVirtualConversation) => void;
}

function ChatVirtualList({ conversations, onSelect }: ChatVirtualListProps) {
  const { t } = useTranslation();
  const [selectedConversation, setSelectedConversation] = useState<ChatVirtualConversation | null>(
    null,
  );

  const handleConversationSelect = useCallback(
    (conversation: ChatVirtualConversation | null | undefined) => {
      if (!conversation) return;
      setSelectedConversation(conversation);
      onSelect?.(conversation);
    },
    [onSelect],
  );

  const hasConversations = Array.isArray(conversations) && conversations.length > 0;

  return (
    <Flex direction="column" className="h-full border-r border-[var(--gray-8)]">
      {hasConversations ? (
        <Box className="overflow-auto">
          {conversations?.map((conversation) => (
            <ChatVirtualItem
              key={conversation.id ?? Math.random()}
              conversation={conversation}
              onSelect={handleConversationSelect}
              isSelected={selectedConversation?.id === conversation.id}
            />
          ))}
        </Box>
      ) : (
        <Flex className="h-full items-center justify-center">
          <Text>{t('chat_virtual_agent.noConversationsFound')}</Text>
        </Flex>
      )}
    </Flex>
  );
}

export default ChatVirtualList;
