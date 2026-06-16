'use client';

import { Flex } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

// ─── Components ────────────────────────────────────────────────
import { MetricCard } from 'components/dashboard/MetricCard';
import { IconBox } from 'components/icons/IconBox';
import Shimmer from 'components/common/Shimmer';

// ─── Icons ─────────────────────────────────────────────────────
import MessageIcon from 'components/icons/MessageIcon';
import TimerIcon from 'components/icons/TimerIcon';
import AiMessageIcon from 'components/icons/AiMessageIcon';
import IssueTicketIcon from 'components/icons/IssueTicketIcon';

// ─── Types ─────────────────────────────────────────────────────
import { CvaDashboardDataV2 } from 'hooks/useCvaDashboardDataV2';

interface DashboardMetricsProps {
  data: CvaDashboardDataV2 | null;
  loading: boolean;
}

const DashboardMetrics = ({ data, loading }: DashboardMetricsProps) => {
  const { t } = useTranslation();
  return (
    <Flex gap="4" className="mb-4 flex-wrap">
      <MetricCard
        icon={
          <IconBox className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF3DE]">
            <MessageIcon />
          </IconBox>
        }
        title={t('dashboard.totalIssues')}
        value={
          loading ? <Shimmer width="5rem" height="2.4rem" /> : data?.total_issues?.toString() || '0'
        }
        tooltip={t('dashboard.totalIssuesTooltip')}
      />
      <MetricCard
        icon={
          <IconBox className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EDEDFB]">
            <TimerIcon />
          </IconBox>
        }
        title={t('dashboard.totalUsers')}
        value={
          loading ? <Shimmer width="5rem" height="2.4rem" /> : data?.total_users?.toString() || 0
        }
        tooltip={t('dashboard.totalUsersTooltip')}
      />
      <MetricCard
        icon={
          <IconBox className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E5F5FF]">
            <AiMessageIcon />
          </IconBox>
        }
        title={t('dashboard.liveConversations')}
        value={
          loading ? (
            <Shimmer width="5rem" height="2.4rem" />
          ) : (
            data?.live_conversations?.toString() || '0'
          )
        }
        tooltip={t('dashboard.liveConversationsTooltip')}
      />
      <MetricCard
        icon={
          <IconBox className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFEAF0]">
            <IssueTicketIcon />
          </IconBox>
        }
        title={t('dashboard.issueResolutionRate')}
        value={
          loading ? (
            <Shimmer width="5rem" height="2.4rem" />
          ) : (
            `${data?.issue_resolution_rate ? data?.issue_resolution_rate?.toString() : '0'}%` || '0'
          )
        }
        tooltip={t('dashboard.issueResolutionRateCvaTooltip')}
      />
    </Flex>
  );
};

export default DashboardMetrics;
