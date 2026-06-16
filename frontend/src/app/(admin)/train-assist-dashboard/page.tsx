'use client';

// ─── Imports ─────────────────────────────────────────────────────
import { useState } from 'react';
import { Box, Flex } from '@radix-ui/themes';

// ─── Context ─────────────────────────────────────────────────────
import { useGlobalContext } from 'contexts/store';

// ─── Components ──────────────────────────────────────────────────
import TrainAssistMetrics from 'components/TrainAssistDashboard/TrainAssistMetrics';
import { useTrainAssistMetrics } from 'hooks/train-assist/useTrainAssistMetrics';
import TicketingFunnel from 'components/TrainAssistDashboard/TicketingFunnel';
import CollectionsOverviewChart from 'components/TrainAssistDashboard/CollectionOverviewChart/CollectionOverviewChart';
import EmployeesTable from 'components/TrainAssistDashboard/EmployeesTable';
import PerformanceSummary from 'components/TrainAssistDashboard/PerformanceSummary';
import { Tower } from '../admin/users/users-overview/TagsManagement';


// ─── Hooks ───────────────────────────────────────────────────────
// import { useTrainAssistDashboardData } from 'hooks/useTrainAssistDashboardData';

interface Props {
  timeframe?: string;
  tagId?: string;
}

// ─── Component ───────────────────────────────────────────────────
export default function TrainAssistAnalyticsPage({ timeframe, tagId }: Props) {
  const { user } = useGlobalContext();

  const orgId = user?.org_id || '';

  const {
    data: dashboardData,
    loading: dashboardLoading,
    error: dashboardError,
  } = useTrainAssistMetrics(orgId, timeframe, tagId);

  return (
    <Box>
      <Flex direction="column" className="h-full">
        <Box className="flex-grow bg-[var(--gray-2)] p-6">
          {/* ─── Metric Summary ─────────────────────────────── */}
          <TrainAssistMetrics data={dashboardData} loading={dashboardLoading} />

          {/* ─── Funnel and Category Charts ────────────────── */}
          <Flex gap="4" className="mb-2 flex-wrap">
            <Box className="h-[311px] min-w-[400px] flex-1">
              <TicketingFunnel data={dashboardData?.progress_funnel} loading={dashboardLoading} />
            </Box>
            <Box className="h-[311px] min-w-[400px] flex-1">
              <CollectionsOverviewChart orgId={orgId} timeframe={timeframe} tagId={tagId}/>
            </Box>
          </Flex>

          {/* ─── User Stats and Top Queries ─────────────────── */}
          <Flex gap="4" className="flex-col flex-wrap xl-custom:flex-row">
            <Box className="min-w-[400px] flex-1">
              <EmployeesTable orgId={orgId} timeframe={timeframe} tagId={tagId}/>
            </Box>
            <Box className="min-w-[400px] flex-1">
              <PerformanceSummary orgId={orgId} timePeriod={timeframe} tagId={tagId}/>
            </Box>
          </Flex>
          
        </Box>
      </Flex>
    </Box>
  );
}
