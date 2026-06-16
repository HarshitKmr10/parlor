'use client';

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Box, Flex, Text } from '@radix-ui/themes';
import * as styles from './IssueCategories.styles';
import { useIssueCategories } from '@/hooks/voice-virtial-agent/useIssueCategories';

// ─── Types ─────────────────────────────────────────────────────

interface IssueCategoriesProps {
  orgId: string;
  timeframe: string;
  tagId?: string;
}

// ─── Component ────────────────────────────────────────────────
const IssueCategories: React.FC<IssueCategoriesProps> = ({ orgId, timeframe, tagId }) => {
  const { data, summary, loading } = useIssueCategories({
    orgId,
    timeframe,
    tagId
  });

  const chartData = useMemo(() => data || [], [data]);

  const noData = !loading && chartData.length === 0;

  const getYAxisDomain = () => {
    if (chartData.length === 0) return [0, 10];
    const maxIssues = Math.max(...chartData.map(item => item.count), 0);
    // Ensure minimum range and proper scaling for small values
    const minRange = Math.max(maxIssues * 1.2, 5);
    return [0, minRange];
  };

  // Custom tooltip to show detailed information
  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: any[];
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <Text size="2" weight="medium" className="text-gray-900 mb-2">
            {data.category}
          </Text>
          <Flex direction="column" gap="1">
            <Text size="1" className="text-gray-600">
              Total Issues: {data.total_issues}
            </Text>
            <Text size="1" className="text-gray-600">
              Percentage: {data.percentage}%
            </Text>
            {data.severity_breakdown && Object.keys(data.severity_breakdown).length > 0 && (
              <Box className="mt-2">
                <Text size="1" weight="medium" className="text-gray-700 mb-1">
                  Severity Breakdown:
                </Text>
                {Object.entries(data.severity_breakdown).map(([severity, count]) => (
                  <Text key={severity} size="1" className="text-gray-600">
                    {severity}: {count as number}
                  </Text>
                ))}
              </Box>
            )}
          </Flex>
        </Box>
      );
    }
    return null;
  };

  return (
    <Box className={`${styles.container} flex flex-col h-full`}>
      {/* Header */}
      <Flex align="center" justify="between" className={styles.header}>
        <Text size="5" weight="medium">
          Issue Categories by Volume
        </Text>
        <Flex className='gap-4'>
        <Flex align="center" className="gap-2">
          <Box className={styles.legendDot} style={{ backgroundColor: '#4F46E5' }} />
          <Text size="1" className={styles.labelColor}>
            {summary?.total_issues} Issues
          </Text>
        </Flex>
        <Flex align="center" className="gap-2">
          <Box className={styles.legendDot} style={{ backgroundColor: '#4F46E5' }} />
          <Text size="1" className={styles.labelColor}>
            {summary?.total_categories} Categories
          </Text>
        </Flex>
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
              margin={{ top: 5, right: 30, left: 0, bottom: 20 }}
              barCategoryGap="20%"
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis 
                dataKey="category" 
                tick={{ fontSize: 12, fill: '#4B5563' }} 
                tickFormatter={(category) => {
                  // Truncate long category names and capitalize first letter
                  const formatted = category.charAt(0).toUpperCase() + category.slice(1);
                  return formatted;
                }}
                height={2}
              />
              <YAxis 
                domain={getYAxisDomain()} 
                tick={{ fontSize: 12, fill: '#4B5563' }} 
                tickFormatter={(value) => value.toString()}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="count"
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

export default IssueCategories;
