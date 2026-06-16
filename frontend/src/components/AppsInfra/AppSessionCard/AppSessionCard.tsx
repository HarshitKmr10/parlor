'use client';

// ─────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { useParams } from 'next/navigation';
import classNames from 'classnames';

import { Flex, Text, Box } from '@radix-ui/themes';

import AppBotIcon from 'components/icons/AppBotIcon';
import AppBotCircle from 'components/icons/AppBotCircel';

import { IncidentSession } from 'hooks/AppsInfra/useIncidentChat';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface AppSessionCardProps {
  session: IncidentSession;
  onSelect: (appId: string) => void;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

const AppSessionCard: React.FC<AppSessionCardProps> = ({ session, onSelect }) => {
  const params = useParams();
  const selectedSessionId = params?.sessionId;

  // Format ISO date to HH:MM format
  const formatTime = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isSelected = session.id === selectedSessionId;

  return (
    <Flex
      align="center"
      justify="between"
      onClick={() => onSelect(session?.appId)}
      className={classNames(
        'mb-3 cursor-pointer gap-3 rounded-lg border border-iris-9 p-3 hover:bg-iris-3',
        isSelected ? 'bg-iris-3' : 'bg-white'
      )}
    >
      {/* Left Section: Icon */}
      <AppBotIcon />

      {/* Middle Section: Session name and app badge */}
      <Flex direction="column" className="min-w-0 flex-1">
        {/* Session title */}
        <Text size="2" weight="bold" className="truncate text-iris-9">
          {session?.name || ''}
        </Text>

        {/* App name badge */}
        <Box
          className="mt-1 inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs"
          style={{
            width: 'fit-content',
            border: '1px solid var(--Colors-Accent-Accent-Alpha-7, #0037ED54)',
          }}
        >
          <AppBotCircle />
          <Text size="1" className="font-medium leading-4 text-[#002BB7C5]">
            {session.app?.name || 'App'}
          </Text>
        </Box>
      </Flex>

      {/* Right Section: Created Time */}
      <Flex align="end" className="h-full">
        <Text size="1" className="font-medium text-gray-11">
          {formatTime(session?.createdAt)}
        </Text>
      </Flex>
    </Flex>
  );
};

export default AppSessionCard;