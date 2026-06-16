'use client';

// ─── Imports ─────────────────────────────────────────────────────
import { Box, Flex } from '@radix-ui/themes';
import { useGlobalContext } from 'contexts/store';

// ─── Components ──────────────────────────────────────────────────
import DashboardMetrics from 'components/CvaDashboard/DashboardMetrics';
import TicketingFunnel from 'components/CvaDashboard/TicketingFunnel';
import CategoryBarChart from 'components/CvaDashboard/CategoryBarChart';
import UserStatsTable from 'components/CvaDashboard/UserStatsTable';
import TopQueries from 'components/CvaDashboard/TopQueries';

// ─── Hooks ───────────────────────────────────────────────────────
import { useCvaDashboardDataV2 } from 'hooks/useCvaDashboardDataV2';
import IssueDetailsTable from 'components/CvaDashboard/IssueDetailsTable';

interface CVADashboardProps {
  timeframe?: string;
}

export default function CVADashboard({ timeframe = '30days' }: CVADashboardProps) {
  const { user } = useGlobalContext();
  const org_id = user?.org_id;
  const timeFilter = timeframe.replace('days', '');

  // Prevent hook calls if org_id is not available
  const shouldRender = !!org_id;

  const { data: cvaDashboardData, loading: cvaDashboardDataLoading } = useCvaDashboardDataV2(
    org_id || '',
    timeframe,
  );

  if (!shouldRender) return null;

  return (
    <Box>
      <Flex direction="column" className="h-full">
        <Box className="flex-grow bg-[var(--gray-2)] p-6">
          {/* ─── Metric Summary ─────────────────────────────── */}
          <DashboardMetrics data={cvaDashboardData} loading={cvaDashboardDataLoading} />

          {/* ─── Funnel and Category Charts ────────────────── */}
          <Flex gap="4" className="mb-2 flex-wrap">
            <Box className="h-[311px] min-w-[400px] flex-1">
              <TicketingFunnel
                ticketing_funnel={cvaDashboardData?.ticketing_funnel}
                loading={cvaDashboardDataLoading}
                isAgentAssist={false}
              />
            </Box>
            <Box className="h-[311px] min-w-[400px] flex-1">
              <CategoryBarChart timeframe={timeFilter} orgId={org_id} />
            </Box>
          </Flex>

          {/* ─── User Stats and Top Queries ─────────────────── */}
          <Flex gap="4" className="flex-col flex-wrap xl-custom:flex-row">
            <Box className="min-w-[400px] flex-1">
              <UserStatsTable timeframe={timeFilter} orgId={org_id} />
            </Box>
            <Box className="min-w-[400px] flex-1">
              <TopQueries timeframe={timeFilter} orgId={org_id} />
            </Box>
          </Flex>

          <Flex gap="4" className="flex-col flex-wrap xl-custom:flex-row">
            <IssueDetailsTable timeframe={timeFilter} orgId={org_id} />
          </Flex>
        </Box>
      </Flex>
    </Box>
  );
}
