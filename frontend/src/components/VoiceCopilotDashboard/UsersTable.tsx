'use client';

import React from 'react';
import { Box, Flex, Text, Table } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import CustomAvatar from 'components/CustomAvatar';
import Shimmer from 'components/common/Shimmer/Shimmer';

// Helper function to format duration with seconds (if < 1 hour) or hours (if >= 1 hour)
const formatDuration = (minutes: number): string => {
  if (!minutes || minutes === 0) return '0m 0s';
  
  const totalMinutes = Math.floor(minutes);
  const seconds = Math.round((minutes - totalMinutes) * 60);
  
  // If >= 60 minutes, show hours and minutes
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  
  // If < 60 minutes, show minutes and seconds
  return seconds > 0 ? `${totalMinutes}m ${seconds}s` : `${totalMinutes}m`;
};

interface AgentPerformance {
  agent_user_id: string;
  agent_name: string;
  total_sessions: number;
  total_tickets: number;
  fcr_percentage: number;
  average_session_duration_min: number;
}

interface UsersTableProps {
  data: AgentPerformance[] | null;
  loading: boolean;
  limit?: number;
}

export default function UsersTable({ data, loading, limit = 10 }: UsersTableProps) {
  const { t } = useTranslation();

  const displayData = data?.slice(0, limit) || [];

  return (
    <Box className="h-[400px] rounded-lg border bg-white p-4">
      <Flex justify="between" align="center" className="mb-4">
        <Text size="5" weight="medium">Users of Platform</Text>
      </Flex>

      <Box className="h-[340px] overflow-y-auto">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="text-gray-600">Agent</Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="text-gray-600">Calls</Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="text-gray-600">Tickets</Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="text-gray-600">FCR %</Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="text-gray-600">Avg Duration</Text>
              </Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {loading ? (
              [...Array(5)].map((_, index) => (
                <Table.Row key={index}>
                  <Table.Cell><Shimmer width="8rem" height="1.5rem" /></Table.Cell>
                  <Table.Cell><Shimmer width="3rem" height="1.5rem" /></Table.Cell>
                  <Table.Cell><Shimmer width="3rem" height="1.5rem" /></Table.Cell>
                  <Table.Cell><Shimmer width="4rem" height="1.5rem" /></Table.Cell>
                  <Table.Cell><Shimmer width="4rem" height="1.5rem" /></Table.Cell>
                </Table.Row>
              ))
            ) : displayData.length > 0 ? (
              displayData.map((agent) => (
                <Table.Row key={agent.agent_user_id}>
                  <Table.Cell>
                    <Flex gap="2" align="center">
                      <CustomAvatar
                        alt={agent.agent_name || 'Unknown'}
                        name={agent.agent_name || 'Unknown'}
                        extra="rounded-sm bg-gray-200 text-xs"
                        height="32px"
                        width="32px"
                        src={null}
                      />
                      <Text size="2" className="text-neutral-l2">
                        {agent.agent_name || 'Unknown'}
                      </Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" weight="medium" className="text-neutral-l2">
                      {agent.total_sessions || 0}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" weight="medium" className="text-neutral-l2">
                      {agent.total_tickets || 0}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex align="center" gap="2">
                      <Box
                        className="h-2 rounded-full"
                        style={{
                          width: '60px',
                          backgroundColor: '#E5E7EB'
                        }}
                      >
                        <Box
                          className="h-2 rounded-full"
                          style={{
                            width: `${Math.min(agent.fcr_percentage, 100)}%`,
                            backgroundColor: agent.fcr_percentage >= 70 ? '#10B981' : agent.fcr_percentage >= 50 ? '#F59E0B' : '#EF4444'
                          }}
                        />
                      </Box>
                      <Text size="2" weight="medium" className="text-neutral-l2">
                        {agent.fcr_percentage.toFixed(1)}%
                      </Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" className="text-neutral-l2">
                      {formatDuration(agent.average_session_duration_min)}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))
            ) : (
              <Table.Row>
                <Table.Cell colSpan={5}>
                  <Flex justify="center" align="center" className="py-8">
                    <Text size="2" color="gray">No agent data available</Text>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  );
}
