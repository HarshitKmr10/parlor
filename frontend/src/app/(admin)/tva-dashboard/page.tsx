'use client';

// ─── Imports ─────────────────────────────────────────────────────
import { Box, Flex } from '@radix-ui/themes';
import { useGlobalContext } from 'contexts/store';

// ─── Components ──────────────────────────────────────────────────
import DashboardMetrics from 'components/TvaDashboard/DashboardMetrics';
import TicketingFunnel from 'components/TvaDashboard/TicketingFunnel/TicketingFunnel';
import KBListing from 'components/TvaDashboard/CategoryBarChart';
import AverageResolutionTime from 'components/TvaDashboard/AverageResolutionTime';
import TicketsHandledOverTime from 'components/TvaDashboard/TicketsHandledOverTime';


interface TVADashboardProps {
  timeframe?: string;
}

export default function TVADashboard({ timeframe = '30days' }: TVADashboardProps) {
  const { user } = useGlobalContext();
  const org_id = user?.org_id;
  // Prevent hook calls if org_id is not available
  const shouldRender = !!org_id;


  if (!shouldRender) return null;

  return (
    <Box>
      <Flex direction="column" className="h-full">
        <Box className="flex-grow bg-[var(--gray-2)] p-6">
          {/* ─── Metric Summary ─────────────────────────────── */}
          <DashboardMetrics timeframe={timeframe} />

          {/* ─── Funnel and Category Charts ────────────────── */}
          <Flex gap="4" className="mb-2 flex-wrap ">
            <Box className="h-[311px] min-w-[400px] flex-1 ">
              <TicketingFunnel
                timeframe={timeframe}
                isAgentAssist={false}
              />
            </Box>
            <Box className="h-[311px] min-w-[400px] flex-1">
              <KBListing timeframe={timeframe} />
            </Box>
          </Flex>

          {/* ─── Resolution Time and Tickets Handled Charts ──────── */}
          <Flex gap="4" className="mb-2 flex-wrap ">
            <Box className="h-[311px] min-w-[400px] flex-1">
              <AverageResolutionTime timeframe={timeframe} orgId={org_id} />
            </Box>
            <Box className="h-[311px] min-w-[400px] flex-1">
              <TicketsHandledOverTime timeframe={timeframe} orgId={org_id} />
            </Box>
          </Flex>

        </Box>
      </Flex>
    </Box>
  );
}
