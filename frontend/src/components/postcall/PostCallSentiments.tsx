import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Flex, Text, Badge, Card, Grid,
} from '@radix-ui/themes';
import AIChatIcon from 'components/icons/AIChatIcon';
import HtmlText from 'components/HtmlText/HtmlText';
import Sentiment from './Sentiment';

interface PostCallSentimentsProps {
  sentiment: string;
  loading: boolean;
  agenName?: string;
  callerName?: string;
}

export function PostCallSentiments({ sentiment, loading, agenName, callerName }: PostCallSentimentsProps) {
  const { t } = useTranslation();
  
  // Replace "Unknown" or "User" with actual caller name in sentiment text
  const processedSentiment = callerName 
    ? sentiment?.replace(/Unknown:/g, `${callerName}:`).replace(/User:/g, `${callerName}:`)
    : sentiment;
  
  if (loading) {
    return (
      <Box className="border-b border-[var(--accent-3)] py-2">
        <Flex gap="2">
          <Box className="ml-3">
            <AIChatIcon />
          </Box>
          <Flex direction="column" width="100%">
            <Flex gap="2">
              <Text size="2" weight="bold" style={{ color: 'var(--pink-9)' }}>
                {agenName || t('knowledge_assist.coResolveFromServicedeskAI')}
              </Text>
              <Badge>{t('knowledge_assist.aiGenerated')}</Badge>
            </Flex>
            <Flex direction="column" gap="2" mt="3" mr="4">
              {[...Array(3)].map((_, index) => (
                <Box
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
          </Flex>
        </Flex>
      </Box>
    );
  }

  const applyNewStyles = (text: string) => {
    const positiveStyle = 'background-color: var(--green-3); color: var(--green-11); font-weight: 500;';
    const negativeStyle = 'background-color: var(--red-3); color: var(--red-11); font-weight: 500;';

    const positiveRegex = /<span style="[^"]*background-color:\s*green[^"]*">/g;
    const negativeRegex = /<span style="[^"]*background-color:\s*red[^"]*">/g;

    return text
      .replace(positiveRegex, `<span style="${positiveStyle}">`)
      .replace(negativeRegex, `<span style="${negativeStyle}">`);
  };

  const countWords = (str: string) => (str ? str.split(' ').filter(Boolean).length : 0);

  const positiveText = processedSentiment
    ?.match(/<span style="[^"]*background-color:\s*green[^"]*">[^<]*<\/span>/g)
    ?.map((match) => match.replace(/<\/?span[^>]*>/g, ''))
    .join(' ') || '';
  const negativeText = processedSentiment
    ?.match(/<span style="[^"]*background-color:\s*red[^"]*">[^<]*<\/span>/g)
    ?.map((match) => match.replace(/<\/?span[^>]*>/g, ''))
    .join(' ') || '';

  const styledSentiment = applyNewStyles(processedSentiment || '');

  const positiveWordsCount = countWords(positiveText);
  const negativeWordsCount = countWords(negativeText);
  const totalWordsCount = countWords((processedSentiment || '').replace(/<[^>]+>/g, ''));

  let posPer = Math.max(0, (positiveWordsCount / totalWordsCount) * 100);
  let negPer = Math.max(0, (negativeWordsCount / totalWordsCount) * 100);
  let overallScorePercentage = Math.max(0, 100 - posPer - negPer);

  // Ensure the sum is 100%
  const total = posPer + negPer + overallScorePercentage;
  if (total !== 100) {
    const scaleFactor = 100 / total;
    posPer *= scaleFactor;
    negPer *= scaleFactor;
    overallScorePercentage *= scaleFactor;
  }

  return (
    <Box className="border-b border-[var(--accent-3)] py-2">
      <Box mx="2" mb="4">
        <Card variant="ghost">
          <Grid columns="3" gap="3">
            <Sentiment
              type="positive"
              title={t('knowledge_assist.positive')}
              percentage={posPer}
            />
            <Sentiment
              type="negative"
              title={t('knowledge_assist.negative')}
              percentage={negPer}
            />
            <Sentiment
              type="overall"
              title={t('knowledge_assist.overall')}
              percentage={overallScorePercentage}
            />
          </Grid>
        </Card>
      </Box>
      <Flex gap="2">
        <Box className="ml-3">
          <AIChatIcon />
        </Box>
        <Flex direction="column">
          <Flex gap="2" align="center">
            <Text size="2" weight="bold" style={{ color: 'var(--pink-9)' }}>
              {agenName || t('knowledge_assist.coResolveFromServicedeskAI')}
            </Text>
            <Badge size="1">{t('knowledge_assist.aiGenerated')}</Badge>
          </Flex>

          <Box className="flex flex-col flex-1 mt-1">
            <HtmlText value={styledSentiment} />
          </Box>
        </Flex>
      </Flex>
    </Box>
  );
}

export default PostCallSentiments;
