'use client';

import React from 'react';
import { Flex, Text, Button } from '@radix-ui/themes';
import { Zap, ChevronRight } from 'lucide-react';
import { SuggestedAction } from 'api/chat/models';

export type { SuggestedAction };

interface SuggestedActionsProps {
  actions: SuggestedAction[];
  onActionSelect: (action: SuggestedAction) => void;
  isDisabled?: boolean;
}

export function SuggestedActions({ 
  actions, 
  onActionSelect, 
  isDisabled = false 
}: SuggestedActionsProps) {
  if (!actions?.length) return null;

  return (
    <Flex 
      direction="column" 
      gap="2" 
      className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3"
    >
      <Flex align="center" gap="2">
        <Zap className="h-4 w-4 text-amber-600" />
        <Text size="2" weight="medium" className="text-amber-800">
          Available Actions
        </Text>
      </Flex>
      
      <Flex direction="column" gap="2">
        {actions.map((action) => (
          <Button
            key={action.action_id}
            variant="ghost"
            disabled={isDisabled}
            onClick={() => onActionSelect(action)}
            className="group flex cursor-pointer items-center justify-between rounded-md border border-amber-200 bg-white px-3 py-2 text-left transition-all hover:border-amber-400 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Flex direction="column" gap="1" className="flex-1">
              <Text size="2" weight="medium" className="text-gray-800">
                {action.display_name}
              </Text>
              <Text size="1" className="text-gray-500">
                {action.description}
              </Text>
            </Flex>
            <ChevronRight 
              className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-amber-600" 
            />
          </Button>
        ))}
      </Flex>
    </Flex>
  );
}

export default SuggestedActions;

