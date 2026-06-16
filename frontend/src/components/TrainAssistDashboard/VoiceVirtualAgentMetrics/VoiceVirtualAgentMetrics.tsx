'use client';

import { Flex } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

// ─── Components ────────────────────────────────────────────────
import { MetricCard } from 'components/dashboard/MetricCard';
import { IconBox } from 'components/icons/IconBox';
import Shimmer from 'components/common/Shimmer';

// ─── Icons ─────────────────────────────────────────────────────
import AiMessageIcon from 'components/icons/AiMessageIcon';
import IssueTicketIcon from 'components/icons/IssueTicketIcon';
import CallIcon from '@/components/icons/CallIcon';
import IssueTicketIconBlue from '@/components/icons/IssueTicketIconBlue';
import { VoiceVirtualAgentDashboardData } from '@/hooks/voice-virtial-agent/useVoiceVirtualAgentMetrics';

// ─── Types ─────────────────────────────────────────────────────
interface Props {
  data: VoiceVirtualAgentDashboardData | null;
  loading: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────
const formatNumber = (value: number | undefined | null): string =>
  typeof value === 'number' ? value.toFixed(0) : '0';

const DecimalUptoOne = (value: number | undefined | null): string =>
  typeof value === 'number' ? value.toFixed(1) : '0';

// ─── Component ─────────────────────────────────────────────────
const VoiceVirtualAgentMetrics = ({ data, loading }: Props) => {
  const { t } = useTranslation();
  return (
    <Flex gap="4" className="mb-4 flex-wrap">
      {/* Total Learners */}
      <MetricCard
        icon={
          <IconBox className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF3DE]">
            <CallIcon />
          </IconBox>
        }
        title={t('dashboard.totalCallsHandled')}
        value={
          loading ? (
            <Shimmer width="5rem" height="2.4rem" />
          ) : (
            formatNumber(Math.round(data?.total_calls_handled || 0))
          )
        }
        tooltip={t('dashboard.totalCallsHandledTooltip')}
      />

      {/* Average Quiz Score */}
      <MetricCard
        icon={
          <IconBox className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E4F6F7]">
            <AiMessageIcon />
          </IconBox>
        }
        title={t('dashboard.totalIssuesHandled')}
        value={
          loading ? (
            <Shimmer width="5rem" height="2.4rem" />
          ) : (
            `${formatNumber(Math.round(data?.total_issues_handled || 0))}`
          )
        }
        tooltip={t('dashboard.totalIssuesHandledTooltip')}
      />

      {/* Attempts to Pass */}
      <MetricCard
        icon={
          <IconBox className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EDEDFB]">
            <IssueTicketIconBlue />
          </IconBox>
        }
        title={t('dashboard.issueResolutionRate')}
        value={
          loading ? (
            <Shimmer width="5rem" height="2.4rem" />
          ) : (
            DecimalUptoOne(data?.issue_resolution_rate || 0)
          )
        }
        tooltip={t('dashboard.issueResolutionRateVvaTooltip')}
      />

      {/* Overall Progress */}
      <MetricCard
        icon={
          <IconBox className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFEAF0]">
            <IssueTicketIcon />
          </IconBox>
        }
        title={t('dashboard.averageCallDuration')}
        value={
          loading ? (
            <Shimmer width="5rem" height="2.4rem" />
          ) : (
            `${formatNumber(Math.round(data?.average_call_duration || 0))}`
          )
        }
        tooltip={t('dashboard.averageCallDurationTooltip')}
      />
    </Flex>
  );
};

export default VoiceVirtualAgentMetrics;
