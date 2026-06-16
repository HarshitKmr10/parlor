"use client";

import { Box, Text, Table, Flex } from "@radix-ui/themes";
import { useTranslation } from 'react-i18next';
import Shimmer from "components/common/Shimmer";
import CustomAvatar from "components/CustomAvatar";
import { useCallback, useState } from "react";

interface Agent {
  id: number;
  name: string;
  totalTimeSpent: string;
  totalSessions: number;
  totalQueries: number;
  avatar?: string;
}

interface UserStats {
  [key: string]: {
    total_queries: number;
    total_sessions: number;
    total_time_spent: number;
    name?: string;
  };
}

interface IdleAgent {
  id: string;
  name: string;
  total_queries: number;
  resolved_queries: number;
  total_sessions: number;
  total_time_spent: number;
}

interface AgentsTableProps {
  timeFilter: string;
  userStats: UserStats | null;
  activeUserStats?: UserStats | null;
  idleAgents?: IdleAgent[] | null;
  isCVA?: boolean;
  isDataLoading?: boolean;
}

export function AgentsTable({ timeFilter, userStats, activeUserStats, idleAgents, isCVA = false, isDataLoading }: AgentsTableProps) {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState("Active");
  const [showAllAgents, setShowAllAgents] = useState(false);

  //   if (isLoading) {
  //     return (
  //       <Box className="p-4 rounded-lg border bg-white">
  //         <Box className="py-4 text-center">Loading...</Box>
  //       </Box>
  //     );
  //   }

  const renderShimmerLoading = useCallback(() => {
      return (
        <Table.Body className="w-full">
          {[...Array(6)].map((_, index) => (
            <Table.Row key={index}>
              <Table.Cell>
                <Flex gap="3">
                  <Shimmer
                    borderRadius="100%"
                    height="30px"
                    width="30px"
                  />
                  <Shimmer width="6rem" height="1.5rem" />
                </Flex>
              </Table.Cell>
              <Table.Cell>
                <Shimmer width="3rem" height="2rem" />
              </Table.Cell>
              <Table.Cell>
                <Shimmer width="3rem" height="2rem" />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      );
    }, [isDataLoading]);

  const agents = activeFilter === "Active"
    ? Object.entries(isCVA ? (userStats || {}) : (activeUserStats || {})).map(([id, stats]) => {
        if (isCVA) {
          // For CVA, use the key as the name
          return {
            id,
            name: id, // Use the key directly as name for CVA
            totalTimeSpent: formatTime(stats.total_time_spent || 0),
            totalSessions: stats.total_sessions || 0,
            totalQueries: stats.total_queries || 0,
          };
        } else {
          // For Agent Assist, keep the original behavior
          return {
            id,
            name: stats?.name || t('dashboard.unknown'),
            totalTimeSpent: formatTime(stats?.total_time_spent || 0),
            totalSessions: stats?.total_sessions || 0,
            totalQueries: stats?.total_queries || 0,
          };
        }
      })
    : // Handle idle agents
      (idleAgents || []).map((agent) => ({
        id: agent.id,
        name: agent.name || t('dashboard.unknown'),
        totalTimeSpent: formatTime(agent.total_time_spent || 0),
        totalSessions: agent.total_sessions || 0,
        totalQueries: agent.total_queries || 0,
      }));

  // Sort agents by total time spent (descending order)
  const displayedAgents = [...agents].sort((a, b) => {
    // Convert time string back to seconds for comparison
    const getSeconds = (timeStr: string) => {
      const [hours, minutes] = timeStr.split('h ');
      return (parseInt(hours) * 3600) + (parseInt(minutes) * 60);
    };
    
    return getSeconds(b.totalTimeSpent) - getSeconds(a.totalTimeSpent);
  });

  

  if (!agents.length && !isDataLoading) {
    return (
      <Box className="mb-6 rounded-lg border bg-white p-4">
        <Flex justify="between" align="center" mb="4">
          <Text size="4" weight="medium">
            {isCVA ? t('dashboard.usersOnThisPlatform') : t('dashboard.agentsOnThisPlatform')}
          </Text>
          {!isCVA && (
            <Flex gap="2">
              <button
                onClick={() => setActiveFilter("Active")}
                className={`px-3 py-1 rounded-md text-sm ${
                  activeFilter === "Active"
                    ? "bg-blue-100 text-blue-700"
                    : "hover:bg-gray-100"
                }`}
              >
                {t('dashboard.active')}
              </button>
              <button
                onClick={() => setActiveFilter("Idle")}
                className={`px-3 py-1 rounded-md text-sm ${
                  activeFilter === "Idle"
                    ? "bg-blue-100 text-blue-700"
                    : "hover:bg-gray-100"
                }`}
              >
                {t('dashboard.idle')}
              </button>
            </Flex>
          )}
        </Flex>
        <Box className="h-[330px] flex items-center justify-center">
          <Text color="gray">{t('dashboard.noUsersDataAvailable')}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="mb-6 rounded-lg border bg-white p-4">
      <Flex justify="between" align="center" mb="4">
        <Text size="4" weight="medium" className="pl-3.5">
          {isCVA ? t('dashboard.usersOnThisPlatform') : t('dashboard.agentsOnThisPlatform')}
        </Text>
        {!isCVA && (
          <Flex gap="2">
            <button
              onClick={() => setActiveFilter('Active')}
              className={`rounded-md px-3 py-1 text-sm ${
                activeFilter === 'Active' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              {t('dashboard.active')}
            </button>
            <button
              onClick={() => setActiveFilter('Idle')}
              className={`rounded-md px-3 py-1 text-sm ${
                activeFilter === 'Idle' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              {t('dashboard.idle')}
            </button>
          </Flex>
        )}
      </Flex>
      
        <Box className="h-[330px] overflow-y-auto">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>{isCVA ? t('dashboard.usersOfPlatform') : t('dashboard.agentsOnThisPlatform')}</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>{t('dashboard.totalSessions')}</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>{t('dashboard.totalQueries')}</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            {isDataLoading ? (
            <>{renderShimmerLoading()}</>
            ) : (
              <Table.Body>
                {displayedAgents.map((agent) => (
                  <Table.Row key={agent.id}>
                    <Table.Cell>
                      <Flex gap="3">
                        <CustomAvatar
                          alt={agent.name}
                          name={agent.name}
                          extra="rounded-full bg-gray-200 text-xs"
                          height="30px"
                          width="30px"
                          src={null}
                        />
                        <Text>{agent.name}</Text>
                      </Flex>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex align="center" justify="start">
                        <Text>{agent.totalSessions}</Text>
                      </Flex>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex align="center" justify="start">
                        {' '}
                        {agent.totalQueries}{' '}
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            )}
          </Table.Root>
        </Box>
      
    </Box>
  );
}

// Helper function to format time
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
