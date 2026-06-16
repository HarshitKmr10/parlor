'use client';

import { Box, Flex } from '@radix-ui/themes';
import { useGlobalContext } from 'contexts/store';
import { TopQueriesTable } from 'components/dashboard/TopQueriesTable';
import { AgentsTable } from 'components/dashboard/AgentsTable';
import { TicketsGraph } from 'components/dashboard/TicketsGraph';
import { TicketingFunnel } from 'components/dashboard/TicketingFunnel';
import AgentAssistMetrics from 'components/AgentAssistDashboard/AgentAssistMetric';
import { IssueCategoriesBarChart } from 'components/AgentAssistDashboard/IssueCategoriesBarChart';
import AgentAssistIssueTable from 'components/AgentAssistDashboard/AgentAssistIssueTable';
import { useAgentAssistDashboardData } from 'hooks/useAgentDashboard';
import { useAgentUserStats } from 'hooks/useAgentUserStats';
import { useAgentIdleAgents } from 'hooks/useAgentIdleAgents';
import { useMemo } from 'react';
import TicketingFunnelcva from '@/components/CvaDashboard/TicketingFunnel';

interface AgentAssistDashboardProps {
  timeframe?: string;
}

export default function AgentAssistDashboard({ timeframe }: AgentAssistDashboardProps) {
  const { user, organization } = useGlobalContext();
  const org_id = user?.org_id;

  const isVersionV3 = useMemo(() => {
    return organization
      ? JSON.parse(organization?.config)['Modules']?.agent_assist?.version === 'v3'
      : false;
  }, [organization]);

  const { data: dashboardData, loading: dashboardLoading } = useAgentAssistDashboardData(
    org_id,
    timeframe || '30days',
    isVersionV3,
  );
  const { data: userStatsData, loading: userStatsLoading } = useAgentUserStats(
    org_id,
    timeframe || '30days',
    isVersionV3,
  );
  const { data: idleAgents, loading: idleAgentsLoading } = useAgentIdleAgents(
    org_id,
    timeframe || '30days',
    isVersionV3,
  );

  const avgSessionTime = userStatsData?.user_stats
    ? (() => {
        const totalTime = Object.values(userStatsData.user_stats).reduce(
          (acc, user) => acc + user.total_time_spent,
          0,
        );
        const totalSessions = Object.values(userStatsData.user_stats).reduce(
          (acc, user) => acc + user.total_sessions,
          0,
        );
        if (totalSessions === 0) return '0s';
        const avgSeconds = Math.round(totalTime / totalSessions);
        if (avgSeconds > 3600) return Math.round(avgSeconds / 3600).toString() + 'h';
        if (avgSeconds > 100) return Math.round(avgSeconds / 60).toString() + 'm';
        return avgSeconds.toString() + 's';
      })()
    : '0s';

  // Prepare data for TicketingFunnelcva component (V3)
  const ticketingFunnelData = useMemo(() => {
    if (!isVersionV3 || !dashboardData?.agent_assist?.ticketing_funnel) {
      return {
        total_queries: 0,
        issues: 0,
        tickets: 0,
      };
    }

    const funnel = dashboardData.agent_assist.ticketing_funnel;
    return {
      total_queries: funnel.total_queries || 0,
      issues: funnel.total_issues || 0,
      tickets: funnel.tickets_discussed || 0,
    };
  }, [isVersionV3, dashboardData]);

  return (
    <Box className="relative h-full bg-[var(--gray-2)]">
      <Flex direction="column" className="h-full">
        <Box className="overflow-y-auto p-6">
          <Box className="space-y-6">
            <AgentAssistMetrics
              dashboardData={dashboardData}
              avgSessionTime={avgSessionTime}
              totalUsers={
                isVersionV3
                  ? dashboardData?.agent_assist?.total_users || 0
                  : userStatsData?.total_users || 0
              }
              loading={dashboardLoading || userStatsLoading}
              isVersionV3={isVersionV3}
            />
            <Flex gap="4" className="flex-wrap">
              <Box className="min-w-[400px] flex-1">
                {!isVersionV3 ? (
                  <TicketingFunnel
                    timeFilter={timeframe}
                    dashboardData={dashboardData}
                    loading={dashboardLoading}
                  />
                ) : (
                  <TicketingFunnelcva
                    ticketing_funnel={ticketingFunnelData}
                    loading={dashboardLoading}
                    isAgentAssist={true}
                  />
                )}
              </Box>
              <Box className="min-w-[400px] flex-1">
                {isVersionV3 ? (
                  <IssueCategoriesBarChart
                    orgId={org_id}
                    timeframe={timeframe || '30days'}
                    isVersionV3={isVersionV3}
                  />
                ) : (
                  <TicketsGraph
                    timeFilter={timeframe}
                    dashboardData={dashboardData}
                    ticketsByDate={userStatsData?.tickets_by_date || []}
                    isDataLoading={dashboardLoading || userStatsLoading}
                  />
                )}
              </Box>
            </Flex>

            <Flex gap="4" className="flex-wrap">
              <Box className="min-w-[400px] flex-1">
                <AgentsTable
                  timeFilter={timeframe}
                  userStats={userStatsData?.user_stats || {}}
                  activeUserStats={userStatsData?.active_user_stats || {}}
                  idleAgents={idleAgents?.data.idle_agents}
                  isDataLoading={userStatsLoading || idleAgentsLoading}
                />
              </Box>
              <Box className="min-w-[400px] flex-1">
                <TopQueriesTable timeFilter={timeframe} isVersionV3={isVersionV3} />
              </Box>
            </Flex>

            {isVersionV3 && (
              <Box className="w-full">
                <AgentAssistIssueTable
                  orgId={org_id}
                  timeframe={timeframe || '30days'}
                  isVersionV3={isVersionV3}
                />
              </Box>
            )}
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}
