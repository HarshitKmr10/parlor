'use client';

// ─── Imports ─────────────────────────────────────────────────────
import { Box, Flex } from '@radix-ui/themes';

// ─── Context ─────────────────────────────────────────────────────
import { useGlobalContext } from 'contexts/store';

// ─── Components ──────────────────────────────────────────────────
import VoiceVirtualAgentMetrics from '@/components/TrainAssistDashboard/VoiceVirtualAgentMetrics';
import { useVoiceVirtualAgentMetrics } from '@/hooks/voice-virtial-agent/useVoiceVirtualAgentMetrics';
import AverageCallHandling from '@/components/AgentAssistDashboard/AverageCallHandling';
import IssueCategories from '@/components/AgentAssistDashboard/IssueCategories';
import TopQueriesTable from '@/components/AgentAssistDashboard/TopQueries';
import MostUsedKbs from '@/components/AgentAssistDashboard/MostUsedKbs';
import IssueDetailsTable from '@/components/AgentAssistDashboard/IssueDetailsTable';


// ─── Hooks ───────────────────────────────────────────────────────
// import { useTrainAssistDashboardData } from 'hooks/useTrainAssistDashboardData';

interface Props {
  timeframe?: string;
  tagId?: string;
}

// ─── Component ───────────────────────────────────────────────────
export default function VoiceVirtualAgentDashboard({ timeframe, tagId }: Props) {
  const { user } = useGlobalContext();

  const orgId = user?.org_id || '';

  const {
    data,
    loading, 
    error
  } = useVoiceVirtualAgentMetrics(orgId, timeframe);


  return (
    <Box>
      <Flex direction="column" className="h-full">
        <Box className="flex-grow bg-[var(--gray-2)] p-6">
          {/* ─── Metric Summary ─────────────────────────────── */}
          <VoiceVirtualAgentMetrics data={data} loading={loading} />

          {/* ─── Funnel and Category Charts ────────────────── */}
          <Flex gap="4" className="mb-2 flex-wrap">
            <Box className="h-[311px] min-w-[400px] flex-1">
              <AverageCallHandling orgId={orgId} timeframe={timeframe}/>
            </Box>
            <Box className="h-[311px] min-w-[400px] flex-1">
              <IssueCategories orgId={orgId} timeframe={timeframe} />
            </Box>
          </Flex>

          {/* ─── User Stats and Top Queries ─────────────────── */}
          <Flex gap="4" className="flex-col flex-wrap xl-custom:flex-row">
            <Box className="min-w-[400px] flex-1">
              <TopQueriesTable orgId={orgId} timeFilter={timeframe}/>
            </Box>
            <Box className="min-w-[400px] flex-1">
              <MostUsedKbs orgId={orgId} timeFilter={timeframe}/>
            </Box>
          </Flex>
          <Flex gap="4" className="flex-col flex-wrap xl-custom:flex-row">
            <IssueDetailsTable timeframe={timeframe} orgId={orgId} />
          </Flex>
        </Box>
      </Flex>
    </Box>
  );
}
