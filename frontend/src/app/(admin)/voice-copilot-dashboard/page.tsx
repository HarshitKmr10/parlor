'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Flex, Text, Table, Button } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from 'contexts/store';
import { MetricCard } from 'components/dashboard/MetricCard';
import { IconBox } from 'components/icons/IconBox';
import Shimmer from 'components/common/Shimmer/Shimmer';
import CustomAvatar from 'components/CustomAvatar';
import TicketingFunnelcva from 'components/VCPDashboard/TicketingFunnel';

import {
  PhoneCall,
  MessageSquare,
  TrendingUp,
  Clock,
  Users,
  AlertCircle,
  BarChart3,
  PieChart
} from 'lucide-react';
import {
  useVCPSummary,
  useVCPTrend,
  useVCPIssues,
  useVCPAgents,
  useVCPSessions,
  useVCPTopIssues,
  useVCPIssueDetails
} from 'hooks/useVoiceCopilotDashboard';
import UsersTable from 'components/VoiceCopilotDashboard/UsersTable';
import TopQueriesSection from 'components/VoiceCopilotDashboard/TopQueriesSection';
import IssueDetailsTable from 'components/VoiceCopilotDashboard/IssueDetailsTable';

// Import Recharts components
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface VoiceCopilotDashboardProps {
  timeframe?: string;
}

const CHART_COLORS = ['#6366F1', '#EBAF78', '#8DD3BB', '#FF6B6B', '#4ECDC4', '#45B7D1'];

export default function VoiceCopilotDashboard({ timeframe = '30days' }: VoiceCopilotDashboardProps) {
  const { t } = useTranslation();
  const { user, organization } = useGlobalContext();
  const [currentPage, setCurrentPage] = useState(1);
  const [issueDetailsPage, setIssueDetailsPage] = useState(1);

  const org_id = user?.org_id || '';

  // Convert timeframe to period format for API
  // Handles both formats:
  // 1. Date range format: "YYYY-MM-DD:YYYY-MM-DD" (from AnalyticsTab)
  // 2. Days format: "30days" (default/fallback)
  const period = useMemo((): string => {
    // If timeframe already contains ":" it's a date range, use it directly
    if (timeframe && timeframe.includes(':')) {
      return timeframe;
    }

    // Otherwise, treat it as "Xdays" format and convert to date range
    const timeFilter = timeframe?.replace('days', '') || '30';
    const days = parseInt(timeFilter) || 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    return `${formatDate(startDate)}:${formatDate(endDate)}`;
  }, [timeframe]);

  // Fetch data using custom hooks
  const { data: summary, loading: summaryLoading } = useVCPSummary(org_id, period);
  const { data: trend, loading: trendLoading } = useVCPTrend(org_id, period);
  const { data: issues, loading: issuesLoading } = useVCPIssues(org_id, period);
  const { data: agents, loading: agentsLoading } = useVCPAgents(org_id, period);
  const { data: sessions, loading: sessionsLoading } = useVCPSessions(org_id, period, currentPage, 10);
  const { data: issueDetails, loading: issueDetailsLoading } = useVCPIssueDetails(
    org_id,
    period,
    undefined,
    undefined,
    issueDetailsPage,
    20
  );

  const shouldRender = !!org_id;

  if (!shouldRender) {
    return (
      <Flex justify="center" align="center" className="h-full">
        <Text size="3" color="gray">Loading...</Text>
      </Flex>
    );
  }

  // Transform data for charts
  const trendChartData = trend?.map((item: any) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    calls: item.sessions || 0,
    queries: item.total_queries || 0,
    avgCitations: item.average_citations_per_query || 0
  })) || [];

  const categoryData = Object.entries(issues?.by_category || {}).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    count: count as number
  }));

  const typeData = Object.entries(issues?.by_type || {}).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    count: count as number
  }));

  const agentData = agents?.slice(0, 5).map((agent: any) => ({
    name: agent.agent_name?.split(' ')[0] || 'Unknown',
    sessions: agent.total_sessions || 0,
    avgCitations: agent.average_citations_per_query || 0
  })) || [];

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

  // Helper functions for calculated metrics
  const getAvgCallDuration = () => {
    // Get average call duration directly without multiplier
    const avgDuration = summary?.average_session_duration_min || 0;
    return formatDuration(avgDuration);
  };

  const getIssueResolutionRate = () => {
    // Get issue resolution rate from backend calculation
    // Based on percentage of issues resolved without creating or updating tickets
    const resolutionRate = summary?.issue_resolution_rate || 0;
    return Math.round(resolutionRate);
  };

  const getAvgCitationsPerQuery = () => {
    // Average number of knowledge base citations provided per query
    const avgCitations = summary?.average_citations_per_query || 0;
    return avgCitations.toFixed(1);
  };

  // Prepare ticketing funnel data with metrics that align with dashboard
  const ticketingFunnelData = {
    total_queries: summary?.total_sessions || 0, // Total Calls
    issues: summary?.total_queries || 0, // Total Queries (answered + unanswered)
    tickets: summary?.total_issues_identified || 0 // Total Issues
  };

  return (
    <Box>
      <Flex direction="column" className="h-full">
        <Box className="flex-grow bg-[var(--gray-2)] p-6">

          {/* Metric Cards */}
          <Flex gap="4" className="mb-6 flex-wrap">
            <MetricCard
              icon={
                <IconBox className="bg-[#FFF3DE] rounded-full w-12 h-12 flex items-center justify-center">
                  <PhoneCall className="w-6 h-6 text-orange-500" />
                </IconBox>
              }
              title="Total Calls Handled"
              value={summaryLoading ? <Shimmer width="5rem" height="2.4rem" /> : (summary?.total_sessions?.toString() || '0')}
              tooltip="Total voice copilot calls handled in the selected period"
            />

            <MetricCard
              icon={
                <IconBox className="bg-[#EDEDFB] rounded-full w-12 h-12 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-purple-500" />
                </IconBox>
              }
              title="Avg Call Duration"
              value={summaryLoading ? <Shimmer width="5rem" height="2.4rem" /> : getAvgCallDuration()}
              tooltip="Average duration of Voice Copilot calls"
            />

            <MetricCard
              icon={
                <IconBox className="bg-[#E5F5FF] rounded-full w-12 h-12 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-500" />
                </IconBox>
              }
              title="Issue Resolution Rate"
              value={summaryLoading ? <Shimmer width="5rem" height="2.4rem" /> : `${getIssueResolutionRate()}%`}
              tooltip="Percentage of issues resolved without creating or updating tickets"
            />

            <MetricCard
              icon={
                <IconBox className="bg-[#FFEAF0] rounded-full w-12 h-12 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-pink-500" />
                </IconBox>
              }
              title="Avg Citations/Query"
              value={summaryLoading ? <Shimmer width="5rem" height="2.4rem" /> : getAvgCitationsPerQuery()}
              tooltip="Average number of knowledge base references provided per query"
            />
          </Flex>

          {/* Charts Row 1 */}
          <Flex gap="4" className="mb-6 flex-wrap">
            {/* Ticketing Funnel */}
            <Box className="min-w-[400px] flex-1">
              <TicketingFunnelcva
                ticketing_funnel={ticketingFunnelData}
                loading={summaryLoading}
                isAgentAssist={true}
              />
            </Box>

            {/* Issue Categories Bar Chart */}
            <Box className="h-[311px] min-w-[400px] flex-1 rounded-lg border bg-white p-4 relative">
              <Flex align="center" justify="between" className="mb-4">
                <Text size="5" weight="medium">Issue Categories by Volume</Text>
                <Flex align="center" className="gap-2">
                  <Box className="h-2 w-2 rounded bg-purple-1000" />
                  <Text size="1" className="text-black opacity-70">Total Issues</Text>
                </Flex>
              </Flex>

              {issuesLoading ? (
                <Box className="h-[241px] w-full animate-pulse rounded-md bg-gray-100" />
              ) : categoryData.length > 0 ? (
                <Box className="relative bottom-[0px] h-[241px]">
                  <ResponsiveContainer width="105%" height="100%">
                    <BarChart data={categoryData} barCategoryGap="20%">
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#4B5563' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#4B5563' }} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
                        itemStyle={{ color: '#4B5563', fontSize: 12 }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#6366F1"
                        fillOpacity={0.6}
                        radius={[4, 4, 0, 0]}
                        barSize={46}
                        background={{ fill: '#D6DBED66' }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Flex justify="center" align="center" className="h-[241px]">
                  <Text size="2" color="gray">No data available</Text>
                </Flex>
              )}
            </Box>
          </Flex>

          {/* Charts Row 2 - Users Table and Top Issues */}
          <Flex gap="4" className="mb-6 flex-wrap">
            {/* Users of Platform Table */}
            <Box className="min-w-[400px] flex-1">
              <UsersTable data={agents} loading={agentsLoading} limit={10} />
            </Box>

            {/* Top Issues Section */}
            <Box className="min-w-[400px] flex-1">
              <TopQueriesSection
                orgId={org_id}
                timeFilter={period}
              />
            </Box>
          </Flex>

          {/* Issue Details Table */}
          <Box className="mb-6">
            <IssueDetailsTable
              data={issueDetails}
              loading={issueDetailsLoading}
              onPageChange={setIssueDetailsPage}
            />
          </Box>

          {/* Recent Sessions Table */}
          <Box className="rounded-lg border bg-white p-4">
            <Flex justify="between" align="center" mb="4">
              <Text size="4" weight="medium">Recent Voice Sessions</Text>
            </Flex>

            <Box className="h-[330px] overflow-y-auto">
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>
                      <Text size="2" weight="regular" className="text-gray-600">Call ID</Text>
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>
                      <Text size="2" weight="regular" className="text-gray-600">Agent</Text>
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>
                      <Text size="2" weight="regular" className="text-gray-600">Employee</Text>
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>
                      <Text size="2" weight="regular" className="text-gray-600">Start Time</Text>
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>
                      <Text size="2" weight="regular" className="text-gray-600">Duration</Text>
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>
                      <Text size="2" weight="regular" className="text-gray-600">Channel</Text>
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>
                      <Text size="2" weight="regular" className="text-gray-600">Queries</Text>
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>
                      <Text size="2" weight="regular" className="text-gray-600">Issues</Text>
                    </Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>

                <Table.Body>
                  {sessionsLoading ? (
                    [...Array(6)].map((_, index) => (
                      <Table.Row key={index}>
                        <Table.Cell><Shimmer width="6rem" height="1.5rem" /></Table.Cell>
                        <Table.Cell><Shimmer width="8rem" height="1.5rem" /></Table.Cell>
                        <Table.Cell><Shimmer width="5rem" height="1.5rem" /></Table.Cell>
                        <Table.Cell><Shimmer width="7rem" height="1.5rem" /></Table.Cell>
                        <Table.Cell><Shimmer width="3rem" height="1.5rem" /></Table.Cell>
                        <Table.Cell><Shimmer width="4rem" height="1.5rem" /></Table.Cell>
                        <Table.Cell><Shimmer width="2rem" height="1.5rem" /></Table.Cell>
                        <Table.Cell><Shimmer width="2rem" height="1.5rem" /></Table.Cell>
                      </Table.Row>
                    ))
                  ) : sessions?.sessions?.length > 0 ? (
                    sessions.sessions.map((session: any) => (
                      <Table.Row key={session.id}>
                        <Table.Cell>
                          <Text size="2" className="text-neutral-l2">
                            {session.meeting_id?.slice(0, 8)}...
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Flex gap="2" align="center">
                            <CustomAvatar
                              alt={session.agent_name || 'Unknown'}
                              name={session.agent_name || 'Unknown'}
                              extra="rounded-sm bg-gray-200 text-xs"
                              height="24px"
                              width="24px"
                              src={null}
                            />
                            <Text size="2" className="text-neutral-l2">
                              {session.agent_name || 'Unknown'}
                            </Text>
                          </Flex>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2" className="text-neutral-l2">
                            {session.employee_id || '-'}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2" className="text-neutral-l2">
                            {session.session_start ? new Date(session.session_start).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '-'}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2" className="text-neutral-l2">
                            {session.session_duration_sec ? formatDuration(session.session_duration_sec / 60) : '-'}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2" className="text-neutral-l2">
                            {session.channel || 'Voice'}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2" className="text-neutral-l2">
                            {session.total_queries || 0}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2" className="text-neutral-l2">
                            {session.total_issues_count || 0}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))
                  ) : (
                    <Table.Row>
                      <Table.Cell colSpan={8}>
                        <Flex justify="center" align="center" className="py-8">
                          <Text size="2" color="gray">No sessions found</Text>
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Root>
            </Box>

            {/* Pagination */}
            {sessions?.pagination && sessions.pagination.total_pages > 1 && (
              <Flex justify="center" gap="2" className="mt-4">
                {Array.from({ length: Math.min(5, sessions.pagination.total_pages) }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    size="1"
                    variant={currentPage === page ? 'solid' : 'outline'}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}
              </Flex>
            )}
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}