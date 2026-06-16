import React from 'react';
import {
  Card, Flex, Text, Box,
} from '@radix-ui/themes';

interface OverallProgressProps {
  progress: number;
  level: string;
}

function OverallProgress({
  progress,
  level,
}: OverallProgressProps) {
  return (
    <Card className="bg-white shadow-sm mt-4">
      <Flex align="center" gap="2">
        <Box position="relative" width="80px" height="80px">
          <svg className="w-full h-full" viewBox="0 0 36 36">
            <path
              d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="3"
            />
            <path
              d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#5753C6"
              strokeWidth="3"
              strokeDasharray="100, 100"
              strokeDashoffset={100 - progress}
            />
          </svg>
          <Text
            size="4"
            weight="medium"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            {progress}
            %
          </Text>
        </Box>
        <Text
          size="4"
          weight="medium"
          color="gray"
          style={{ marginLeft: '8px' }}
        >
          {level}
          {' '}
          Level
        </Text>
      </Flex>
    </Card>
  );
}

export default OverallProgress;
