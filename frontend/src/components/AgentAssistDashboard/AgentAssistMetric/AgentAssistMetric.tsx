'use client';

import { Flex } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { MetricCard } from 'components/dashboard/MetricCard';
import { IconBox } from 'components/icons/IconBox';
import { Box, UserIcon } from 'lucide-react';
import { AgentAssistDashboardData } from 'hooks/useAgentDashboard';
import Shimmer from 'components/common/Shimmer';
import IssueTicketIconBlue from '@/components/icons/IssueTicketIconBlue';

interface AgentAssistMetricsProps {
  dashboardData: AgentAssistDashboardData | null;
  avgSessionTime: string;
  totalUsers: number;
  loading: boolean; 
  isVersionV3?: boolean;
}

const AgentAssistMetrics = ({
  dashboardData,
  avgSessionTime,
  totalUsers,
  loading,
  isVersionV3
}: AgentAssistMetricsProps) => {
  const { t } = useTranslation();

  if (!dashboardData && !loading) {
    return <Box className="flex w-full items-center justify-center m-4">{t('dashboard.noMetricsAvailable')}</Box>;
  }

  // ─── Helpers ───────────────────────────────────────────────────
const formatNumber = (value: number | undefined | null): string =>
  typeof value === 'number' ? value.toFixed(0) : '0';

const DecimalUptoOne = (value: number | undefined | null): string =>
  typeof value === 'number' ? value.toFixed(1) : '0';

const formatPercentage = (value: number | undefined | null): string => {
  if (typeof value !== 'number') return '0';
  if (value === 0) return '0';
  return `${value.toFixed(1)}%`;
};

  return (
    <Flex gap="4" className="flex-wrap">
      <MetricCard
        icon={
          <IconBox className="bg-[#FFF3DE] rounded-full w-12 h-12 flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 13.4876 3.36093 14.891 4 16.1272L3 21L7.87279 20C9.10904 20.6391 10.5124 21 12 21Z"
                stroke="#EBB922"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="1.5" fill="#EBB922" />
              <circle cx="7.5" cy="12" r="1.5" fill="#EBB922" />
              <circle cx="16.5" cy="12" r="1.5" fill="#EBB922" />
            </svg>
          </IconBox>
        }
        title={t('dashboard.totalQueries')}
        value={loading ? <Shimmer width='5rem' height='2.4rem' /> : dashboardData?.agent_assist?.queries?.toString() || '0'}
        tooltip={t('dashboard.totalQueriesTooltip')}
      />

      <MetricCard
        icon={
          <IconBox className="bg-[#EDEDFB] rounded-full w-12 h-12 flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"
                stroke="#5B5BD6"
                strokeWidth="2"
              />
              <path
                d="M12 7V12L15 15"
                stroke="#5B5BD6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M16 12H19"
                stroke="#5B5BD6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </IconBox>
        }
        title={isVersionV3 ? t('dashboard.totalTickets') : t('dashboard.averageSessionTime')}
        value={loading ? <Shimmer width='5rem' height='2.4rem' /> : isVersionV3 ? dashboardData?.agent_assist?.total_tickets || 0  : avgSessionTime}
        tooltip={t('dashboard.totalTicketsTooltip')}
      />

      {!isVersionV3 && (
        <MetricCard
        icon={
          <IconBox className="bg-[#E5F5FF] rounded-full w-12 h-12 flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 13.4876 3.36093 14.891 4 16.1272L3 21L7.87279 20C9.10904 20.6391 10.5124 21 12 21Z"
                stroke="#0EA5E9"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="1.5" fill="#0EA5E9" />
              <circle cx="7.5" cy="12" r="1.5" fill="#0EA5E9" />
              <circle cx="16.5" cy="12" r="1.5" fill="#0EA5E9" />
            </svg>
          </IconBox>
        }
        title={t('dashboard.totalChatSessions')}
        value={loading ? <Shimmer width='5rem' height='2.4rem' /> : dashboardData?.agent_assist?.chat_sessions?.toString() || '0'}
        tooltip={t('dashboard.totalChatSessionsTooltip')}
      />
      )}

      

      <MetricCard
        icon={
          <IconBox className="bg-[#FFEAF0] rounded-full w-12 h-12 flex items-center justify-center">
            <UserIcon color="#EF5A7A" className="w-6 h-6" />
          </IconBox>
        }
        title={t('dashboard.agentsOnPlatform')}
        value={loading ? <Shimmer width='5rem' height='2.4rem' /> : totalUsers.toString()}
        tooltip={t('dashboard.agentsOnPlatformTooltip')}
      />
      {isVersionV3 && (
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
            formatPercentage(dashboardData?.agent_assist?.ticketing_funnel?.issue_resolution_rate || 0)
          )
        }
        tooltip={t('dashboard.issueResolutionRateTooltip')}
      />
      )}
    </Flex>
  );
};

export default AgentAssistMetrics;
