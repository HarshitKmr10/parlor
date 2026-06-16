'use client';

import { Flex } from '@radix-ui/themes';
import { useGlobalContext } from 'contexts/store';

// ─── Components ────────────────────────────────────────────────
import { MetricCard } from 'components/dashboard/MetricCard';
import { IconBox } from 'components/icons/IconBox';
import Shimmer from 'components/common/Shimmer';

// ─── Icons ─────────────────────────────────────────────────────
import MessageIcon from 'components/icons/MessageIcon';
import TimerIcon from 'components/icons/TimerIcon';
import AiMessageIcon from 'components/icons/AiMessageIcon';
import IssueTicketIcon from 'components/icons/IssueTicketIcon';

// ─── Hooks ─────────────────────────────────────────────────────
import { useOrgMetrics } from '../../../hooks/ticketting-assist';

interface DashboardMetricsProps {
  timeframe?: string;
}

const DashboardMetrics = ({ timeframe = '30days' }: DashboardMetricsProps) => {
  const { user } = useGlobalContext();
  const org_id = user?.org_id;
  
  const { data, loading } = useOrgMetrics(org_id || '', timeframe);
  return (
    <Flex gap="4" className="mb-4 flex-wrap">
      <MetricCard
        icon={
          <IconBox className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF3DE]">
            <MessageIcon />
          </IconBox>
        }
        title={'Resolution Rate'}
        value={
          loading ? <Shimmer width="5rem" height="2.4rem" /> : `${data?.resolution_rate ? data?.resolution_rate?.toFixed(1) : '0'}%` || '0%'
        }
        tooltip="Percentage of tickets successfully resolved"
      />
      <MetricCard
        icon={
          <IconBox className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EDEDFB]">
            <TimerIcon />
          </IconBox>
        }
        title={'Avg. Resolution Time'}
        value={
          loading ? <Shimmer width="5rem" height="2.4rem" /> : `${data?.average_resolution_time ? Math.round(data?.average_resolution_time) : '0'} mins` || '0 mins'
        }
        tooltip="Average time to resolve tickets in minutes"
      />
      <MetricCard
        icon={
          <IconBox className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E5F5FF]">
            <AiMessageIcon />
          </IconBox>
        }
        title={"Avg. User's Response Time"}
        value={
          loading ? (
            <Shimmer width="5rem" height="2.4rem" />
          ) : (
            '5 mins'
          )
        }
        tooltip="Average user response time"
      />
      <MetricCard
        icon={
          <IconBox className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFEAF0]">
            <IssueTicketIcon />
          </IconBox>
        }
        title={'Avg. Conversation Length'}
        value={
          loading ? (
            <Shimmer width="5rem" height="2.4rem" />
          ) : (
            '4.4'
          )
        }
        tooltip="Average conversation length"
      />
    </Flex>
  );
};

export default DashboardMetrics;
