
'use client';

import { Box, Flex, Text, Tooltip } from '@radix-ui/themes';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import React from 'react';

interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | React.ReactNode;
  subtitle?: string;
  isLoading?: boolean;
  onClick?: () => void;
  tooltip?: string;
}

export function MetricCard({
  icon,
  title,
  value,
  subtitle,
  isLoading,
  onClick,
  tooltip
}: MetricCardProps) {
  return (
    <Box
      className={`
        p-6 rounded-xl border bg-white 
        ${onClick ? 'cursor-pointer hover:bg-gray-50' : ''}
        min-w-[250px] flex-1
      `}
      onClick={onClick}
    >
      <Flex gap="4" align="start">
        {/* Icon Circle */}
        <Box className="w-12 h-12 rounded-full flex items-center justify-center bg-[#FFF6E5]">
          {icon}
        </Box>

        {/* Content */}
        <Flex direction="column" gap="1">
          <Flex align="center" gap="1">
            <Text size="2" color="gray" weight="regular">
              {title}
            </Text>
            {Boolean(tooltip) && (
              <Tooltip content={tooltip}>
                <Box>
                  <InfoCircledIcon className="w-4 h-4 text-black-400" />
                </Box>
              </Tooltip>
            )}
          </Flex>
          <Text size="8" weight="bold" className="leading-none">
            {value}
          </Text>
          {!!subtitle && (
            <Text size="2" color="gray">
              {subtitle}
            </Text>
          )}
        </Flex>
      </Flex>
    </Box>
  );
}
