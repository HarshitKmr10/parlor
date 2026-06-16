'use client';

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Box, Flex, Text } from '@radix-ui/themes';
import * as styles from './CollectionOverviewChart.styles'; // Reusing same styles
import { useCollectionsData } from '@/hooks/train-assist/useCollectionsData';

// ─── Types ─────────────────────────────────────────────────────

interface CollectionsOverviewChartProps {
  orgId: string;
  timeframe: string;
  tagId?: string;
}

// ─── Constants ────────────────────────────────────────────────
const MAX_BAR_HEIGHT = 100;

// ─── Component ────────────────────────────────────────────────
const CollectionsOverviewChart: React.FC<CollectionsOverviewChartProps> = ({ orgId, timeframe, tagId }) => {
  const { data, loading } = useCollectionsData({
    orgId,
    timeframe,
    tagId
  });

  const chartData = useMemo(() => data || [], [data]);

  const noData = !loading && chartData.length === 0;

  return (
    <Box className={styles.container}>
      {/* Header */}
      <Flex align="center" justify="between" className={styles.header}>
        <Text size="5" weight="medium">
          Collections Overview
        </Text>
        <Flex align="center" className="gap-2">
          <Box className={styles.legendDot} style={{ backgroundColor: '#4F46E5' }} />
          <Text size="1" className={styles.labelColor}>
            Completion %
          </Text>
        </Flex>
      </Flex>

      {/* Chart / Fallback UI */}
      <Box className={`${styles.chartWrapper} ${loading || noData ? '' : 'left-[-1.5rem]'}`}>
        {loading ? (
          <Box className="h-[241px] w-full animate-pulse rounded-md bg-gray-100" />
        ) : noData ? (
          <Flex align="center" justify="center" className="h-[241px]">
            <Text size="2" color="gray">
              No data found
            </Text>
          </Flex>
        ) : (
          <ResponsiveContainer width="105%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              barCategoryGap="20%"
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#4B5563' }} tickFormatter={(name) => name.charAt(0).toUpperCase() + name.slice(1)}/>
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#4B5563' }} tickFormatter={(value) => `${value}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
                itemStyle={{ color: '#4B5563', fontSize: 12 }}
                labelStyle={{ color: '#4B5563', fontSize: 12 }}
                formatter={(value, name) => {
                  const num = typeof value === 'number' ? value : parseFloat(value as string);
                  return [`${num.toFixed(1)}%`, 'Completion'];
                }}
              />
              <Bar
                dataKey="completion"
                fill="#4F46E5"
                fillOpacity={0.6}
                radius={[4, 4, 0, 0]}
                barSize={46}
                background={{ fill: '#D6DBED66' }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Box>
  );
};

export default CollectionsOverviewChart;
