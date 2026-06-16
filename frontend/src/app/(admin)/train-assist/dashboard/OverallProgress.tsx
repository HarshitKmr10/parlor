import React from 'react';
import {
  Flex, Text, Box, Progress,
} from '@radix-ui/themes';

interface OverallProgressProps {
  overallProgressData: {
    overallProgress: number;
    level: string;
    totalLearners: number;
    lessonsCompleted: number;
    avgCompletionRate: number;
  };
}

function OverallProgress({
  overallProgressData,
}: OverallProgressProps) {
  return (
    <Box>
      {/* Progress and Level */}
      <Flex justify="between" align="center" mb="4">
        <Flex direction="column">
          <Text size="5" weight="bold">
            Overall Progress
          </Text>
          <Text size="2" color="gray">
            {overallProgressData.level}
            {' '}
            level
          </Text>
        </Flex>
        <Text size="5" weight="bold" color="iris">
          {overallProgressData.overallProgress}
          %
        </Text>
      </Flex>

      {/* Statistics Section */}
      <Flex justify="between" gap="2">
        <Flex className="flex-1 flex-col bg-gray-100 rounded-lg p-4 items-center justify-center">
          <Text size="5" weight="bold">
            {overallProgressData.totalLearners}
          </Text>
          <Text size="1" color="gray">
            Total Learners/
          </Text>
          <Text size="1" color="gray">
            Agents
          </Text>
        </Flex>
        <Flex className="flex-1 flex-col bg-gray-100 rounded-lg p-4 items-center justify-center">
          <Text size="5" weight="bold">
            {overallProgressData.lessonsCompleted}
            %
          </Text>
          <Text size="1" color="gray">
            Total Lessons
          </Text>
          <Text size="1" color="gray">
            Completed
          </Text>
        </Flex>
        <Flex className="flex-1 flex-col bg-gray-100 rounded-lg p-4 items-center justify-center">
          <Text size="5" weight="bold">
            {overallProgressData.avgCompletionRate}
            %
          </Text>
          <Text size="1" color="gray">
            Average
          </Text>
          <Text size="1" color="gray">
            Completion Rate
          </Text>
        </Flex>
      </Flex>
    </Box>
  );
}

export default OverallProgress;
