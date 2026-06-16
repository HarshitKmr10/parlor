'use client';

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Box, Flex, Text } from '@radix-ui/themes';
import { useModulesPerformanceData } from '@/hooks/train-assist/useModulesPerformanceData';

interface Props {
  orgId: string;
  timePeriod: string;
  tagId?: string;
}

const PeformanceSummary: React.FC<Props> = ({ orgId, timePeriod, tagId }) => {
  const { t } = useTranslation();
  const { data, loading } = useModulesPerformanceData({
    timePeriod,
    orgId,
    tagId
  });

  const chartData = useMemo(() => data || [], [data]);

  const maxValue = useMemo(() => {
    if (chartData.length === 0) return 100;
    const values = chartData.flatMap((d) => [
      d.topicsCompleted,
      d.avgQuizScore,
    ]);
    return Math.ceil(Math.max(...values) / 10) * 10;
  }, [chartData]);

  const noData = !loading && chartData.length === 0;

  return (
    <Box className="mb-6 rounded-lg border bg-white p-4">
      {/* Header */}
      <Flex align="center" justify="between" className="mb-4">
        <Text size="4" weight="medium">
          {t('train_assist.collectionPerformanceSummary')}
        </Text>
        <Flex align="center" gap="4" className="text-sm">
          <Flex align="center" gap="1">
            <Box className="h-3 w-3 rounded-full bg-[#4F46E5]" />
            <Text size="1" className="text-gray-600">
              {t('train_assist.modulesCompleted')}
            </Text>
          </Flex>
          <Flex align="center" gap="1">
            <Box className="h-3 w-3 rounded-full bg-[#F87171]" />
            <Text size="1" className="text-gray-600">
              {t('train_assist.quizAvgScore')}
            </Text>
          </Flex>
          <Flex align="center" gap="1">
            <Box className="h-3 w-3 rounded-full bg-[#71f8f1]" />
            <Text size="1" className="text-gray-600">
              {t('train_assist.simulationAvgScore')}
            </Text>
          </Flex>
        </Flex>
      </Flex>

      {/* Chart / Fallback */}
      <Box className="relative h-[241px] w-full">
        {loading ? (
          <Box className="h-full w-full animate-pulse rounded-md bg-gray-100" />
        ) : noData ? (
          <Flex align="center" justify="center" className="h-full">
            <Text size="2" color="gray">
              {t('train_assist.noDataFound')}
            </Text>
          </Flex>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
            className={`relative ${loading || noData ? '' : 'left-[-1.5rem]'}`}
          >
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#4B5563' }}
                tickFormatter={(name) => name.charAt(0).toUpperCase() + name.slice(1)}
              />
              <YAxis domain={[0, maxValue]} tick={{ fontSize: 12, fill: '#4B5563' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
                itemStyle={{ color: '#4B5563', fontSize: 12 }}
                labelStyle={{ color: '#4B5563', fontSize: 12 }}
                labelFormatter={(label) => label.charAt(0).toUpperCase() + label.slice(1)}
                formatter={(value, name) => {
                  if (name === 'topicsCompleted') return [value, t('train_assist.averageModulesCompleted')];
                  if (name === 'avgQuizScore') return [value, t('train_assist.averageQuizScore')];
                  if (name === 'avgSimulationScore') return [value, t('train_assist.averageSimulationScore')];
                  return [value, name];
                }}
              />
              <Bar dataKey="topicsCompleted" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgQuizScore" fill="#F87171" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgSimulationScore" fill="#71f8f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Box>
  );
};

export default PeformanceSummary;
