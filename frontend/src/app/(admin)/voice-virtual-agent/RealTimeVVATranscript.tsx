import React from 'react';
import { Box, Flex, Text, Avatar } from '@radix-ui/themes';
import HtmlText from 'components/HtmlText/HtmlText';
import AIChatIcon from 'components/icons/AIChatIcon';
import { useTranslation } from 'react-i18next';

function RealTimeVVATranscript({
  content,
  userName,
  timestamp,
  role,
  extra,
}: {
  content: string;
  userName: string;
  timestamp?: string;
  role: string;
  extra?: string;
}) {
  const { t } = useTranslation();
  const generateFallback = (name: string): string => {
    if (!name) return '?';
    const names = name.trim().split(' ');
    return names.length === 1
      ? names[0][0].toUpperCase()
      : `${names[0][0]}${names[1][0]}`.toUpperCase();
  };
  const fallbackText = generateFallback(userName);

  return (
    <Box
      style={{ background: role === 'assistant' ? 'var(--accent-3)' : 'white' }}
      className={extra}
    >
      <Flex gap="2" mt="2">
        {role === 'assistant' ? (
          <AIChatIcon />
        ) : (
          <Avatar
            size="1"
            variant="solid"
            fallback={fallbackText}
            radius="medium"
            className="ml-2"
          />
        )}

        <Flex direction="column" pb="2">
          <Flex gapX="2" align="center">
            <Text size="2" weight="bold" style={{ color: 'var(--pink-9)' }}>
              {role === 'assistant' ? t('voice_virtual_agent.voiceVirtualAgent') : userName}
            </Text>
            {/* <Text size="1" weight="medium" style={{ color: 'var(--gray-9)' }}>
              {timestamp}
            </Text> */}
          </Flex>
          <HtmlText value={content || t('voice_virtual_agent.noContentProvided')} />
        </Flex>
      </Flex>
    </Box>
  );
}

export default RealTimeVVATranscript;