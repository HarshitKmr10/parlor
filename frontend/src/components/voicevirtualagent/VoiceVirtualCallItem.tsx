// VoiceVirtualCallItem.tsx

import React from 'react';
import moment from 'moment';
import {
  Box, Card, Flex, Text,
} from '@radix-ui/themes';
import CustomAvatar from 'components/CustomAvatar';
import { VoiceAgentCalls } from 'api/voiceVirtualAgent';

interface VoiceVirtualCallItemProps {
  call: VoiceAgentCalls;
  onSelect: (call: VoiceAgentCalls) => void;
  isSelected: boolean;
}

function VoiceVirtualCallItem({
  call,
  onSelect,
  isSelected,
}: VoiceVirtualCallItemProps) {
  const callDate = moment(call.created_at);
  const formattedDate = callDate.format('ddd, D MMMM,');
  const startTime = callDate.format('hh:mm A');

  return (
    <div className="relative">
      <Box m="3">
        <Card
          onClick={() => onSelect(call)}
          onKeyDown={(e) => e.key === 'Enter' && onSelect(call)}
          variant="ghost"
          className={`cursor-pointer  ${isSelected ? 'bg-[var(--accent-3)]' : ''}`}
        >
          <Flex gap="2" align="center" justify="between">
            <Flex align="center" gap="2">
              <Box position="relative">
                <CustomAvatar alt="image" src={null} name={call.user_name} />
                {call.status === 'ongoing' && (
                <div
                  className="absolute right-0 bottom-0 bg-green-500 h-3 w-3 rounded-full"
                  style={{ boxShadow: '0 0 5px 3px rgba(34, 197, 94, 0.4)' }}
                />
                )}
              </Box>
              <Box>
                <Text as="div" size="2" weight="bold" className={isSelected ? 'text-[var(--accent-11)]' : ''}>
                  {call.user_name}
                </Text>
                <Text as="div" size="1" color="gray">
                  {call.caller}
                </Text>
              </Box>
            </Flex>
            <Box>
              <Text as="div" size="1" color="gray">
                {formattedDate}
              </Text>
              <Text as="div" size="1" color="gray" align="right">
                {startTime}
              </Text>
            </Box>
          </Flex>
        </Card>
      </Box>
      <div className="border-b border-gray-200 mt-2 " />
    </div>
  );
}

export default React.memo(VoiceVirtualCallItem);
