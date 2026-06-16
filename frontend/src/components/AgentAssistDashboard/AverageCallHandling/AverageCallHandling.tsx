'use client';

import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Box, Flex, Text, RadioGroup } from '@radix-ui/themes';
import * as styles from './AverageCallHandling.styles';
import { useAverageCallHandling } from '@/hooks/voice-virtial-agent/useAverageCallHandling';
import { format, parseISO, startOfWeek, endOfWeek, addDays, differenceInDays } from 'date-fns';

// ─── Types ─────────────────────────────────────────────────────

interface AverageCallHandlingProps {
  orgId: string;
  timeframe: string;
  tagId?: string;
}

type MetricType = 'calls' | 'average_time';

interface GroupedData {
  period: string;
  calls: number;
  average_time: number;
  count: number;
}

// ─── Component ────────────────────────────────────────────────
const AverageCallHandling: React.FC<AverageCallHandlingProps> = ({ orgId, timeframe, tagId }) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('calls');
  
  const { data, loading } = useAverageCallHandling({
    orgId,
    timeframe,
    tagId
  });

  const groupedChartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Determine grouping strategy based on data length and timeframe
    const dataLength = data.length;
    let groupSize = 1;
    let groupLabel = 'day';
    
    if (dataLength > 9) {
      if (dataLength <= 14) {
        // 10-14 days: group by 2 days
        groupSize = 2;
        groupLabel = '2 days';
      } else if (dataLength <= 21) {
        // 15-21 days: group by 3 days
        groupSize = 3;
        groupLabel = '3 days';
      } else if (dataLength <= 28) {
        // 22-28 days: group by 4 days
        groupSize = 4;
        groupLabel = '4 days';
      } else if (dataLength <= 35) {
        // 29-35 days: group by 5 days
        groupSize = 5;
        groupLabel = '5 days';
      } else if (dataLength <= 45) {
        // 36-45 days: group by 6 days
        groupSize = 6;
        groupLabel = '6 days';
      } else if (dataLength <= 63) {
        // 46-63 days: group by 7 days (week)
        groupSize = 7;
        groupLabel = 'week';
      } else if (dataLength <= 90) {
        // 64-90 days: group by 10 days
        groupSize = 10;
        groupLabel = '10 days';
      } else if (dataLength <= 135) {
        // 91-135 days: group by 15 days
        groupSize = 15;
        groupLabel = '15 days';
      } else if (dataLength <= 180) {
        // 136-180 days: group by 20 days
        groupSize = 20;
        groupLabel = '20 days';
      } else {
        // More than 180 days: group by 30 days (month)
        groupSize = 30;
        groupLabel = 'month';
      }
    }
    
    // Group the data
    const grouped: GroupedData[] = [];
    
    for (let i = 0; i < data.length; i += groupSize) {
      const group = data.slice(i, i + groupSize);
      const totalCalls = group.reduce((sum, item) => sum + item.calls, 0);
      const totalTime = group.reduce((sum, item) => sum + (item.average_time * item.calls), 0);
      const avgTime = totalCalls > 0 ? totalTime / totalCalls : 0;
      
      // Create period label
      let periodLabel = '';
      if (groupSize === 1) {
        // Single day
        periodLabel = format(parseISO(group[0].date), 'MMM d');
      } else if (groupSize === 7) {
        // Week grouping
        const startDate = parseISO(group[0].date);
        const endDate = parseISO(group[group.length - 1].date);
        periodLabel = `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`;
      } else if (groupSize >= 30) {
        // Month grouping
        const startDate = parseISO(group[0].date);
        periodLabel = format(startDate, 'MMM yyyy');
      } else {
        // Custom grouping
        const startDate = parseISO(group[0].date);
        const endDate = parseISO(group[group.length - 1].date);
        periodLabel = `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`;
      }
      
      grouped.push({
        period: periodLabel,
        calls: totalCalls,
        average_time: Math.round(avgTime * 10) / 10, // Round to 1 decimal place
        count: group.length
      });
    }
    
    return grouped.map(item => ({
      ...item,
      displayValue: selectedMetric === 'calls' ? item.calls : item.average_time
    }));
  }, [data, selectedMetric]);

  const noData = !loading && groupedChartData.length === 0;

  const formatTimeDisplay = (minutes: number): string => {
    // Round to 2 decimal places to avoid floating point precision issues
    const roundedMinutes = Math.round(minutes * 100) / 100;
    
    if (roundedMinutes < 60) {
      return `${Math.round(roundedMinutes)} min`;
    }
    
    if (roundedMinutes < 1440) { // Less than 24 hours (24 * 60)
      const hours = Math.floor(roundedMinutes / 60);
      const remainingMinutes = Math.round(roundedMinutes % 60);
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes.toString().padStart(2, '0')}m` : `${hours}h`;
    }
    
    if (roundedMinutes < 43200) { // Less than 30 days (30 * 24 * 60)
      const days = Math.floor(roundedMinutes / 1440);
      const remainingHours = Math.floor((roundedMinutes % 1440) / 60);
      const remainingMinutes = Math.round(roundedMinutes % 60);
      
      if (remainingHours > 0 && remainingMinutes > 0) {
        return `${days}d ${remainingHours}h ${remainingMinutes.toString().padStart(2, '0')}m`;
      } else if (remainingHours > 0) {
        return `${days}d ${remainingHours}h`;
      } else if (remainingMinutes > 0) {
        return `${days}d ${remainingMinutes.toString().padStart(2, '0')}m`;
      }
      return `${days}d`;
    }
    
    // More than 30 days - convert to months
    const months = Math.floor(roundedMinutes / 43200);
    const remainingDays = Math.floor((roundedMinutes % 43200) / 1440);
    const remainingHours = Math.floor((roundedMinutes % 1440) / 60);
    
    if (remainingDays > 0 && remainingHours > 0) {
      return `${months}mo ${remainingDays}d ${remainingHours}h`;
    } else if (remainingDays > 0) {
      return `${months}mo ${remainingDays}d`;
    } else if (remainingHours > 0) {
      return `${months}mo ${remainingHours}h`;
    }
    return `${months}mo`;
  };

  const getYAxisDomain = () => {
    if (selectedMetric === 'calls') {
      const maxCalls = Math.max(...groupedChartData.map(item => item.calls), 0);
      return [0, Math.max(maxCalls * 1.1, 100)];
    } else {
      const maxTime = Math.max(...groupedChartData.map(item => item.average_time), 0);
      return [0, Math.max(maxTime * 1.1, 10)];
    }
  };

  const getTooltipFormatter = (value: any, name: string) => {
    if (selectedMetric === 'calls') {
      return [value, 'No. of calls'];
    } else {
      return [formatTimeDisplay(value), 'Average Time'];
    }
  };

  return (
    <Box className={styles.container}>
      {/* Header */}
      <Flex align="center" justify="between" className={styles.header}>
        <Text size="5" weight="medium">
          Average Call Handling Status
        </Text>
        
        {/* Radio Buttons */}
        <RadioGroup.Root 
          value={selectedMetric} 
          onValueChange={(value) => setSelectedMetric(value as MetricType)}
          className="flex items-center gap-2"
        >
          <Flex align="center" gap="2">
          <Flex align="center" gap="2">
            <RadioGroup.Item value="calls" id="calls" className="w-4 h-4" />
            <label htmlFor="calls" className="text-sm font-medium cursor-pointer">
              No. of calls
            </label>
          </Flex>
          <Flex align="center" gap="2">
            <RadioGroup.Item value="average_time" id="average_time" className="w-4 h-4" />
            <label htmlFor="average_time" className="text-sm font-medium cursor-pointer">
              Average Time
            </label>
          </Flex>
          </Flex>
        </RadioGroup.Root>
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
              data={groupedChartData}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              barCategoryGap="20%"
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis 
                dataKey="period" 
                tick={{ fontSize: 12, fill: '#4B5563' }}
                interval={0}
              />
              <YAxis 
                domain={getYAxisDomain()} 
                tick={{ fontSize: 12, fill: '#4B5563' }} 
                tickFormatter={(value) => {
                  if (selectedMetric === 'calls') {
                    return value.toString();
                  } else {
                    return formatTimeDisplay(value);
                  }
                }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
                itemStyle={{ color: '#4B5563', fontSize: 12 }}
                labelStyle={{ color: '#4B5563', fontSize: 12 }}
                formatter={getTooltipFormatter}
                labelFormatter={(label) => `Period: ${label}`}
              />
              <Bar
                dataKey="displayValue"
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

export default AverageCallHandling;
