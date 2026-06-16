import React from 'react';
import { Box, Flex, Text, Badge } from '@radix-ui/themes';
import MarkDownText from 'components/MarkDownText/MarkDownText';
import AIChatIcon from 'components/icons/AIChatIcon';
import { useTranslation } from 'react-i18next';


interface Props {
  summary: string;
  loading: boolean;
  agentName?: string;
  meetingId?: string;
}

const PostCallSummary: React.FC<Props> = ({ summary, loading, agentName, meetingId }) => {
  const { t } = useTranslation();
  const aiLabel = agentName || t('voice_virtual_agent.coResolveFromServicedeskAI');

  const SkeletonLoader = () => (
    <Flex direction="column" gap="2" mt="3" mr="4" className="w-full">
      {[...Array(3)].map((_, index) => (
        <div
          key={index}
          className="loading-skeleton"
          style={{
            width: '100%',
            height: '16px',
            backgroundColor: 'var(--accent-4)',
            borderRadius: 'var(--radius-2)',
          }}
        />
      ))}
    </Flex>
  );

  return (
    <Box className="border-b border-[var(--accent-3)] py-4 space-y-4">
      <Flex gap="3" align="start">
        <Box mt="1">
          <AIChatIcon />
        </Box>
        <Flex direction="column" gap="2" className="w-full">
          <Flex gap="2" align="center">
            <Text size="2" weight="bold" className="text-[var(--pink-9)]">
              {aiLabel}
            </Text>
            <Badge>{t('voice_virtual_agent.aiGenerated')}</Badge>
          </Flex>

          {loading ? (
            <SkeletonLoader />
          ) : (
            <Box className="prose prose-sm dark:prose-invert max-w-none">
              <MarkDownText value={summary} codeTextColor="text-bgColor-dark" />
            </Box>
          )}
        </Flex>
      </Flex>
    </Box>
  );
};

export default PostCallSummary;