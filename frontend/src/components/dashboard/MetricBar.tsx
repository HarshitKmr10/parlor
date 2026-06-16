import React from 'react';
import { Box, Flex, Text } from '@radix-ui/themes';

interface MetricBarProps {
  label: string;
  value: number;
  color: string;
  maxValue?: number;
}

export const MetricBar: React.FC<MetricBarProps> = React.memo(({
  label,
  value,
  color,
  maxValue = 100,
}) => {
  const percentage = (value / maxValue) * 100;

  return (
    <Box className="w-[calc(50%-8px)]">
      <Flex justify="between" mb="1">
        <Text size="2" color="gray">
          {label}
        </Text>
        <Text size="2" weight="bold">
          {value}
%
</Text>
      </Flex>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full ${color} transition-all duration-300 ease-in-out`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={maxValue}
          aria-label={`${label} metric`}
        />
      </div>
    </Box>
  );
});

MetricBar.displayName = 'MetricBar';
