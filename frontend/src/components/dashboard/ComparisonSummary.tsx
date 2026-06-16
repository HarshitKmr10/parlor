import React from 'react';
import { Box, Flex, Text, Badge, Tooltip } from '@radix-ui/themes';
import AISparkle from 'components/icons/AISparkle';
import type { ComparisonSummary as ComparisonSummaryType } from 'types/dashboard';

interface ComparisonSummaryProps {
  summary: ComparisonSummaryType;
}

const ComparisonSummary: React.FC<ComparisonSummaryProps> = ({ summary }) => {
  return (
    <Box className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <Flex
        align="center"
        gap="2"
        className="px-4 py-3 border-b border-gray-200 bg-purple-50"
      >
        <AISparkle />
        <Text size="2" weight="medium" className="text-purple-900">
          Comparison Summary
        </Text>
      </Flex>

      {/* Content */}
      <Box className="p-4">
        {/* Title */}
        <Text size="4" weight="bold" className="block mb-3">
          {summary.summary_title}
        </Text>

        {/* Description */}
        <Text size="2" className="block mb-4 text-gray-700">
          {summary.description}
        </Text>

        {/* Key Highlights */}
        <Box className="mb-4">
          <Text size="2" weight="bold" className="block mb-2">
            Key Highlights:
          </Text>
          <ul className="list-none space-y-1 ml-0">
            {summary.key_highlights.map((highlight, index) => (
              <li key={index} className="text-sm text-gray-700">
                {highlight}
              </li>
            ))}
          </ul>
        </Box>

        {/* Metrics */}
        <Flex gap="4" wrap="wrap" className="mt-4">
          <Tooltip content="How similar the original documents were to each other. High (85%+) = almost duplicates, Medium (60-85%) = related content, Low (<60%) = different topics.">
            <Flex align="center" gap="1" className="cursor-help">
              <Text size="2">🧩</Text>
              <Text size="1" className="text-gray-600">
                Similarity:
              </Text>
              <Text size="2" weight="bold">
                {Math.round(summary.similarity_score)}%
              </Text>
            </Flex>
          </Tooltip>

          <Tooltip content="Percentage of unique information preserved after merging. Low (0-10%) = mostly duplicates removed, Medium (10-30%) = some unique details added, High (30%+) = significant unique content from each document combined.">
            <Flex align="center" gap="1" className="cursor-help">
              <Text size="2">≡</Text>
              <Text size="1" className="text-gray-600">
                Unique Content Retained:
              </Text>
              <Text size="2" weight="bold">
                {Math.round(summary.unique_content_retained)}%
              </Text>
            </Flex>
          </Tooltip>

          <Tooltip content="AI's confidence in the quality and completeness of this merge. High = clear matches and clean merge, Medium = mostly consistent but may need review, Low = documents too different, user review recommended.">
            <Flex align="center" gap="1" className="cursor-help">
              <Text size="2">☑</Text>
              <Text size="1" className="text-gray-600">
                Merge Confidence:
              </Text>
              <Badge
                size="1"
                variant="soft"
                color={
                  summary.merge_confidence === 'High'
                    ? 'green'
                    : summary.merge_confidence === 'Medium'
                    ? 'yellow'
                    : 'red'
                }
              >
                {summary.merge_confidence}
              </Badge>
            </Flex>
          </Tooltip>
        </Flex>
      </Box>
    </Box>
  );
};

export default React.memo(ComparisonSummary);
