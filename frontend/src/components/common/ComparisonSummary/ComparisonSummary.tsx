import React from 'react';
import { Box, Flex, Text, Tooltip } from '@radix-ui/themes';
import SparklesIcon from 'components/icons/SparklesIcon';
import WandIcon from 'components/icons/WandIcon';
import type { ComparisonSummary as ComparisonSummaryType } from 'types/dashboard';
import { comparisonSummaryStyles } from './ComparisonSummary.styles';
import { CopyIcon, ListPlusIcon } from 'lucide-react';

interface ComparisonSummaryProps {
  summary: ComparisonSummaryType;
}

const ComparisonSummary: React.FC<ComparisonSummaryProps> = ({ summary }) => {
  return (
    <Box className={comparisonSummaryStyles.container} style={comparisonSummaryStyles.containerBackground}>
      {/* Header */}
      <Flex
        align="center"
        justify="between"
        gap="2"
        className={comparisonSummaryStyles.header.container}
      >
        <Box className={comparisonSummaryStyles.header.titleBox} style={comparisonSummaryStyles.header.titleBoxStyle}>
          <SparklesIcon />
          <Text size="2" weight="medium" className={comparisonSummaryStyles.header.text}>
            Comparison Summary
          </Text>
        </Box>
        <Flex align="center" gap="2" className={comparisonSummaryStyles.header.rightSection}>
          <WandIcon />
        </Flex>
      </Flex>

      {/* Content */}
      <Box className={comparisonSummaryStyles.content.container}>
        {/* Title */}
        <Text size="4" weight="bold" className={comparisonSummaryStyles.content.title}>
          {summary.summary_title}
        </Text>

        {/* Description */}
        <Text size="2" className={comparisonSummaryStyles.content.description}>
          {summary.description}
        </Text>

        {/* Key Highlights */}
        <Box>
          <Text size="2" weight="bold" className={comparisonSummaryStyles.highlights.title}>
            Key Highlights:
          </Text>
          <ul className={comparisonSummaryStyles.highlights.list}>
            {summary.key_highlights.map((highlight, index) => (
              <li key={index} className={comparisonSummaryStyles.highlights.item}>
              {highlight}
              </li>
            ))}
          </ul>
        </Box>

        {/* Metrics */}
        <Flex className={comparisonSummaryStyles.metrics.container}>
          <Tooltip content={
            <p className='p-1'>
              <p className='text-xs'><strong>How similar the original documents were to each other.</strong></p>
              <br />
              <strong>High (85%+)</strong> = almost duplicates
              <br />
              <strong>Medium (60-85%)</strong> = related content
              <br />
              <strong>Low (&lt;60%)</strong> = different topics
            </p>
          }>
            <Flex align="center" gap="1" className={comparisonSummaryStyles.metrics.item} style={comparisonSummaryStyles.metrics.itemStyle}>
              <Text size="1" className={comparisonSummaryStyles.metrics.label}>
                Similarity:
                {Math.round(summary.similarity_score)}%
              </Text>
            </Flex>
          </Tooltip>

          <Tooltip content={
            <p className='p-1'>
              <p className='text-xs'><strong>Shows how much new, non-duplicate information was preserved after merging. This indicates how much distinct content remains instead of being removed as duplicates.</strong></p>
              <br />
              <strong>Low (0-10%)</strong> = mostly duplicates were removed
              <br />
              <strong>Medium (10-30%)</strong> = some unique details were added
              <br />
              <strong>High (30%+)</strong> = significant unique content from each document was combined
            </p>
          }>
            <Flex align="center" gap="1" className={comparisonSummaryStyles.metrics.item} style={comparisonSummaryStyles.metrics.itemStyle}>
              <ListPlusIcon color='#646464' width={12} height={12}/>
              <Text size="1" className={comparisonSummaryStyles.metrics.label}>
                Unique Content Retained:
                {Math.round(summary.unique_content_retained)}%
              </Text>
            </Flex>
          </Tooltip>

          <Tooltip content={
            <p className='p-1'>
              <p className='text-xs'><strong>Overall AI quality score combining similarity, overlap, and content consistency. This reflects how reliable the merged output is.</strong></p>
              <br />
              <strong>High confidence</strong> = clear matches and clean merge
              <br />
              <strong>Medium</strong> = mostly consistent but may need review
              <br />
              <strong>Low</strong> = documents are too different and user review is recommended
            </p>
          }>
            <Flex align="center" gap="1" className={comparisonSummaryStyles.metrics.item} style={comparisonSummaryStyles.metrics.itemStyle}>
              <CopyIcon color='#646464' width={12} height={12}/>
              <Text size="1" className={comparisonSummaryStyles.metrics.label}>
                Merge Confidence:
                {summary.merge_confidence}
              </Text>
            </Flex>
          </Tooltip>
        </Flex>
      </Box>
    </Box>
  );
};

export default React.memo(ComparisonSummary);
