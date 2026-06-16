import React from 'react';
import { Box, Flex, Text, Avatar } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import AIChatIcon from 'components/icons/AIChatIcon';
import MarkDownText from 'components/MarkDownText/MarkDownText';

interface RealTimeChatTranscriptProps {
  content: string;
  userName: string;
  role: 'user' | 'assistant';
  extra?: string;
}

function RealTimeChatTranscript({
  content,
  userName,
  role,
  extra,
}: RealTimeChatTranscriptProps) {
  const { t } = useTranslation();
  
  const generateFallback = (name: string): string => {
    if (!name) return '?';
    const names = name.trim().split(' ');
    return names.length === 1
      ? names[0][0].toUpperCase()
      : `${names[0][0]}${names[names.length > 1 ? 1 : 0][0]}`.toUpperCase();
  };

  const fallbackText = generateFallback(userName);

  return (
    <Box
      style={{ background: role === 'assistant' ? 'var(--accent-3)' : 'white' }}
      className={`px-4 py-2 ${extra || ''}`}
    >
      <Flex gap="2" className="items-start">
        {role === 'assistant' ? (
          <Box className="flex-shrink-0 mt-1">
            <AIChatIcon />
          </Box>
        ) : (
          <Avatar
            size="2"
            variant="solid"
            fallback={fallbackText}
            radius="medium"
            className="flex-shrink-0 mt-1"
          />
        )}

        <Flex direction="column" className="flex-grow min-w-0">
          <Flex gap="2" align="center" className="mb-1">
            <Text size="2" weight="bold" style={{ color: 'var(--pink-9)' }}>
              {role === 'assistant' ? t('chat_virtual_agent.aiAssistant') : userName}
            </Text>
          </Flex>
          <Box className="break-words">
            <MarkDownText value={content || t('chat_virtual_agent.noContentProvided')} />
          </Box>
        </Flex>
      </Flex>
    </Box>
  );
}

export default RealTimeChatTranscript;