import React, { useEffect, useState } from 'react';
import {
  Box, Flex, Text, Card, Progress,
} from '@radix-ui/themes';

type SentimentType = 'positive' | 'negative' | 'overall';

interface SentimentProps {
  type: SentimentType;
  title: string;
  percentage: number;
}

function Sentiment({ title, type, percentage }: SentimentProps) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 100);

    return () => clearTimeout(timer);
  }, [percentage]);

  const getColor = (sentimentType: SentimentType) => {
    switch (sentimentType) {
      case 'positive':
        return 'green';
      case 'negative':
        return 'red';
      case 'overall':
        return 'blue';
      default:
        return 'blue';
    }
  };

  const color = getColor(type);

  return (
    <Card size="1" variant="surface">
      <Flex direction="column" gap="2">
        <Flex justify="between" align="center">
          <Box
            px="2"
            pb="1"
            style={{
              backgroundColor: `var(--${color}-3)`,
              borderRadius: 'var(--radius-2)',
            }}
          >
            <Text size="1" weight="bold" style={{ color: `var(--${color}-11)` }}>
              {title}
            </Text>
          </Box>
          <Text size="1" weight="bold" style={{ color: `var(--${color}-11)` }}>
            {`${percentage.toFixed(1)}%`}
          </Text>
        </Flex>
        <Box>
          <Progress
            value={animatedPercentage}
            color={`${color}`}
          />
        </Box>
      </Flex>
    </Card>
  );
}

export default Sentiment;
