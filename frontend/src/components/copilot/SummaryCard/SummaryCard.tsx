'use client';

import React, { useState } from 'react';
import { Box, Flex, Text, Button, Spinner } from '@radix-ui/themes';
import { MoreHorizontal, ArrowRight } from 'lucide-react';
import SparklesIcon from '@/components/icons/SparklesIcon';
import WandIcon from '@/components/icons/WandIcon';
import VVASummaryDialog from '../Suggestions/VVASummaryDialog';

interface SummaryCardProps {
  title?: string;
  summary: string;
  category?: string;
  assignee?: {
    name: string;
    avatar?: string;
  };
  onViewTicket?: () => void;
  ticketAction?: 'create' | 'update' | 'view' | '';
  description?: string;
  isLoading?: boolean;
}

/**
 * Summary Card Component
 *
 * Displays a summary card with the design from the screenshot:
 * - Purple header with VVA Summary tag and sparkle icon
 * - Issue summary with truncated text
 * - Footer with category tag, assignee, and action button
 *
 * @param viewOnly - When true, hides the action button (for display-only mode)
 * @param ticketAction - Determines button text: 'create' | 'update' | 'view'
 */
const SummaryCard: React.FC<SummaryCardProps> = ({
  title = 'VVA Summary',
  summary,
  category = 'NETWORK ISSUE',
  assignee,
  onViewTicket,
  ticketAction = 'create',
  description = '',
  isLoading = false,
}) => {
  // Truncate description text to match the design
  const truncatedDescription = description
    ? description
    : summary?.length > 150
      ? `${summary.substring(0, 150)}...`
      : summary;

  // Get button text based on action type
  const getButtonText = () => {
    switch (ticketAction) {
      case 'create':
        return 'Create Ticket';
      case 'update':
        return 'Update Ticket';
      case 'view':
        return 'View Ticket';
      case '':
      return '';
      default:
        return '';
    }
  };

  const handleViewTicket = () => {
    if (onViewTicket) {
      onViewTicket();
    }
  };

  return (
    <Box className="max-h-44 min-h-36 rounded-lg border border-[#A7A1D3] bg-[#FAF6FE] bg-gradient-to-r px-4  pb-2 pt-2">
      {/* Header Section */}
      <Flex justify="between" align="center" className="mb-1">
        {Boolean(title) && (
          <Flex align="center" gap="2">
            <Box className="flex items-center gap-1 rounded-md border border-[#A7A1D3] px-2 py-1">
              <SparklesIcon className="h-3 w-3" />
              <Text size="1" weight="medium">
                {title}
              </Text>
            </Box>
          </Flex>
        )}

        <WandIcon className="h-4 w-4" />
      </Flex>

      {/* Content Section */}
      <Box className="mb-2">
        <Text
          size="3"
          weight="medium"
          className="block overflow-hidden text-ellipsis whitespace-nowrap text-[#222222]"
        >
          {summary}
        </Text>
        <Text size="2" className="line-clamp-2 text-neutral-l2">
          {truncatedDescription}
        </Text>
      </Box>

      {/* Footer Section */}
      <Flex justify="between" align="center">
        <Flex align="center" gap="2">
          <Flex
            align={'center'}
            justify={'center'}
            className="h-6 rounded-md border border-[#A7A1D3] px-1 text-neutral-l2"
          >
            <Text size="1" weight="medium">
              {category}
            </Text>
          </Flex>

          {assignee && (
            <Flex align="center" gap="2">
              <Flex
                align="center"
                gap="1"
                className="h-6 rounded-md border border-[#E8E8E8] bg-white px-2 text-[#646464]"
              >
                <Box className="flex h-4 w-4 items-center justify-center rounded-md bg-gradient-to-br from-purple-400 to-pink-400">
                  <Text size="1" className="font-bold text-white">
                    {assignee.name.charAt(0)}
                  </Text>
                </Box>
                <Text size="1" weight="medium" className="text-[#646464]">
                  {assignee.name}
                </Text>
              </Flex>
              <Flex
                align="center"
                justify="center"
                className="h-6 rounded-md border border-[#E8E8E8] bg-white px-2 text-[#646464]"
              >
                <MoreHorizontal className="h-3 w-3 text-gray-400" />
              </Flex>
            </Flex>
          )}
        </Flex>
        {getButtonText() !== '' && (
          <Button
            size="2"
            variant="solid"
            className="bg-black flex items-center gap-1 rounded-md px-3 py-1 text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleViewTicket}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Spinner size="1" />
                <Text size="1" weight="medium">
                  Loading...
                </Text>
              </>
            ) : (
              <>
                <Text size="1" weight="medium">
                  {getButtonText()}
                </Text>
                <ArrowRight className="h-3 w-3" />
              </>
            )}
          </Button>
        )}
      </Flex>
    </Box>
  );
};

export default SummaryCard;
