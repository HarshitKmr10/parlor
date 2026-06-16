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
interface Props {
  data: {
    total_learners?: number;
    average_quiz_score?: number;
    average_attempts_before_pass?: number;
    average_overall_progress?: number;
  } | null;
  loading: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────
const formatNumber = (value: number | undefined | null): string =>
  typeof value === 'number' ? value.toFixed(0) : '0';

const DecimalUptoOne = (value: number | undefined | null): string =>
  typeof value === 'number' ? value.toFixed(1) : '0';

// ─── Component ─────────────────────────────────────────────────
const TrainAssistMetrics = ({ data, loading }: Props) => {
  const { t } = useTranslation();
  return (
    <Flex gap="4" className="mb-4 flex-wrap">
      {/* Total Learners */}
      <MetricCard
        icon={
          <IconBox className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF3DE]">
            <MessageIcon />
          </IconBox>
        }
        title={t('train_assist.totalLearners')}
        value={
          loading ? <Shimmer width="5rem" height="2.4rem" /> : formatNumber(Math.round(data?.total_learners || 0))
        }
        tooltip={t('train_assist.totalLearnersTooltip')}
      />

      {/* Average Quiz Score */}
      <MetricCard
        icon={
          <IconBox className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EDEDFB]">
            <TimerIcon />
          </IconBox>
        }
        title={t('train_assist.avgQuizScore')}
        value={
          loading ? <Shimmer width="5rem" height="2.4rem" /> : `${formatNumber(Math.round(data?.average_quiz_score || 0))}%`
        }
        tooltip={t('train_assist.avgQuizScoreTooltip')}
      />

      {/* Attempts to Pass */}
      <MetricCard
        icon={
          <IconBox className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E4F6F7]">
            <AiMessageIcon />
          </IconBox>
        }
        title={t('train_assist.attemptsToPassQuiz')}
        value={
          loading ? <Shimmer width="5rem" height="2.4rem" /> : DecimalUptoOne((data?.average_attempts_before_pass || 0))
        }
        tooltip={t('train_assist.attemptsToPassQuizTooltip')}
      />

      {/* Overall Progress */}
      <MetricCard
        icon={
          <IconBox className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFEAF0]">
            <IssueTicketIcon />
          </IconBox>
        }
        title={t('train_assist.overallProgress')}
        value={
          loading ? <Shimmer width="5rem" height="2.4rem" /> : `${formatNumber(Math.round(data?.average_overall_progress || 0))}%`
        }
        tooltip={t('train_assist.overallProgressTooltip')}
      />
    </Flex>
  );
};

export default TrainAssistMetrics;