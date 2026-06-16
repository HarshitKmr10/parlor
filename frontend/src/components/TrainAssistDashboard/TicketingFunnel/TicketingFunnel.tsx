'use client';

// ─── Imports ─────────────────────────────────────────────────────
import React, { useCallback } from 'react';
import { Box, Text, Flex } from '@radix-ui/themes';
import Shimmer from 'components/common/Shimmer';

// ─── Styles ─────────────────────────────────────────────────────
import * as styles from './TicketingFunnel.styles';

// ─── Types ──────────────────────────────────────────────────────
interface TrainAssistFunnelData {
  topic_started: number;
  quizes_attempted: number;
  simulation_done: number;
}

interface TrainAssistFunnelProps {
  data: TrainAssistFunnelData | null;
  loading?: boolean;
}

interface MetricBoxProps {
  value: number | React.ReactNode;
  label: string;
  color: string;
}

// ────────────────────────────────────────────────────────────────
// MetricBox
// ────────────────────────────────────────────────────────────────
function MetricBox({ value, label, color }: MetricBoxProps) {
  const [firstWord, ...restWords] = label.split(' ');
  return (
    <Flex gap="3">
      <Text size="8" weight="medium" className="flex-end" style={{ color }}>
        {value}
      </Text>
      <Box className="-ml-2 flex flex-col justify-end pb-1">
        <Text size="2" className="leading-tight">
          {firstWord}
        </Text>
        <Text size="2" className="leading-tight">
          {restWords.join(' ')}
        </Text>
      </Box>
    </Flex>
  );
}

// ────────────────────────────────────────────────────────────────
// TrainAssistFunnel Component
// ────────────────────────────────────────────────────────────────
const TrainAssistFunnel = ({ data, loading }: TrainAssistFunnelProps) => {
  const renderFunnelBackgroundSvg = useCallback(
    () => (
      <svg
        width="100%"
        height="195"
        viewBox="0 0 950 200"
        preserveAspectRatio="xMidYMid meet"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="animate-pulse opacity-20"
        style={{ animationDuration: '4s' }}
      >
        <path
          opacity="0.1"
          d="M251.804 130.535H0.616211V0.351562C0.616211 0.351562 39.3987 1.4663 63.6874 6.28758C88.7241 11.2573 101.989 17.4718 126.21 25.6936C149.974 33.7601 162.233 41.8217 186.539 47.9215C211.521 54.1908 251.804 56.8126 251.804 56.8126V130.535Z"
          transform="translate(0, 18) scale(1.5, 1.5)"
          fill="url(#gradient_topic)"
        />
        <path
          opacity="0.1"
          d="M251.231 75.5348H0.0429688V0.257812C0.0429688 0.257812 38.9109 3.17274 63.1142 9.06682C88.2355 15.1845 101.146 22.8807 125.637 31.3493C149.13 39.4729 161.692 46.5909 185.966 51.5999C211.043 56.7748 251.231 56.7411 251.231 56.7411V75.5348Z"
          transform="translate(300, 125) scale(1.5, 1.5)"
          fill="url(#gradient_quiz)"
        />
        <path
          opacity="0.1"
          d="M251.234 20.6304H0.0458984V0.0234375C0.0458984 0.0234375 38.9138 0.821394 63.1171 2.43489C88.2384 4.10959 101.149 6.21641 125.64 8.5347C149.133 10.7585 161.695 12.707 185.969 14.0782C211.046 15.4949 251.234 15.4856 251.234 15.4856V20.6304Z"
          transform="translate(600, 180) scale(1.5, 1.5)"
          fill="url(#gradient_simulation)"
        />
        <defs>
          <linearGradient id="gradient_topic" x1="126" y1="0" x2="126" y2="130" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4F46E5" stopOpacity="0.5" />
            <stop offset="1" stopColor="#4F46E5" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="gradient_quiz" x1="125" y1="0" x2="125" y2="75" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563EB" stopOpacity="0.3" />
            <stop offset="1" stopColor="#2563EB" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="gradient_simulation" x1="125" y1="0" x2="125" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0891B2" stopOpacity="0.3" />
            <stop offset="1" stopColor="#0891B2" stopOpacity="0.05" />
          </linearGradient>
        </defs>
      </svg>
    ),
    [],
  );

  const renderFunnelStaticSvg = useCallback(
    () => (
      <svg
        width="100%"
        height="195"
        viewBox="0 0 1250 200"
        preserveAspectRatio="xMidYMid meet"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M251.804 128.805H0.616211V0.984375C0.616211 0.984375 39.3987 2.07888 63.6874 6.81266C88.7241 11.6922 101.989 17.7939 126.21 25.8665C149.974 33.7865 162.233 41.7018 186.539 47.6909C211.521 53.8465 251.804 56.4207 251.804 56.4207V128.805Z"
          transform="translate(0, 18) scale(1.5, 1.5)"
          fill="url(#topic)"
        />
        <path
          d="M251.231 73.8048H0.0429688V0.890625C0.0429688 0.890625 38.9109 3.71406 63.1142 9.42314C88.2355 15.3488 101.146 22.8034 125.637 31.0063C149.13 38.8748 161.692 45.7694 185.966 50.6212C211.043 55.6336 251.231 55.601 251.231 55.601V73.8048Z"
          transform="translate(400, 100) scale(1.5, 1.5)"
          fill="url(#quiz)"
        />
        <path
          d="M251.234 20.8039H0.0458984V0.84375C0.0458984 0.84375 38.9138 1.61666 63.1171 3.17951C88.2384 4.80165 101.149 6.84234 125.64 9.08786C149.133 11.2419 161.695 13.1292 185.969 14.4574C211.046 15.8296 251.234 15.8206 251.234 15.8206V20.8039Z"
          transform="translate(800, 180) scale(1.5, 1.5)"
          fill="url(#simulation)"
        />
        <defs>
          <linearGradient id="topic" x1="126" y1="0" x2="126" y2="129" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4F46E5" stopOpacity="0.5" />
            <stop offset="1" stopColor="#4F46E5" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="quiz" x1="125" y1="0" x2="125" y2="74" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563EB" stopOpacity="0.3" />
            <stop offset="1" stopColor="#2563EB" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="simulation" x1="125" y1="0" x2="125" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0891B2" stopOpacity="0.3" />
            <stop offset="1" stopColor="#0891B2" stopOpacity="0.05" />
          </linearGradient>
        </defs>
      </svg>
    ),
    [],
  );

  return (
    <Box className={styles.container}>
      <Box className="mb-4 flex items-start justify-between">
        <Text size="5" weight="medium">Learning Progress Funnel</Text>
      </Box>

      <Box className="relative gap-4 max-w-2xl">
        {/* Background + Static Funnel SVGs */}
        <Box className="relative bottom-[5px] h-[195px]">
          <div className="absolute inset-0 flex items-start">
            <div className="absolute inset-0 flex items-start">{renderFunnelBackgroundSvg()}</div>
            {renderFunnelStaticSvg()}
          </div>
        </Box>

        {/* Metric Values */}
        <Box className="absolute w-full" style={{ bottom: 'min(2rem, 10%)' }}>
          <Flex className="relative">
            <Box className="absolute text-left" style={{ left: '0%' }}>
              <MetricBox
                value={loading ? <Shimmer width="3rem" height="2.5rem" /> : data?.topic_started ?? 0}
                label={'Total Modules Completed'}
                color="#4F46E5"
              />
            </Box>

            <Box className="absolute min-w-[120px] text-left" style={{ left: '33%' }}>
              <MetricBox
                value={loading ? <Shimmer width="3rem" height="2.5rem" /> : data?.quizes_attempted ?? 0}
                label={(data?.quizes_attempted ?? 0) === 1 ? 'Quiz Attempted' : 'Quizzes Attempted'}
                color="#2563EB"
              />
            </Box>

            <Box className="absolute text-left" style={{ left: '65%' }}>
              <MetricBox
                value={loading ? <Shimmer width="3rem" height="2.5rem" /> : data?.simulation_done ?? 0}
                label={(data?.simulation_done ?? 0) === 1 ? 'Simulation Done' : 'Simulations Done'}
                color="#0891B2"
              />
            </Box>
          </Flex>
        </Box>
      </Box>
    </Box>
  );
};

export default TrainAssistFunnel;