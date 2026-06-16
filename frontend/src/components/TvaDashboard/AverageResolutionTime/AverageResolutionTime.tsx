'use client';

// ─── Imports ─────────────────────────────────────────────────────
import { useMemo } from 'react';
import { Box, Text, Flex } from '@radix-ui/themes';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

// ─── Components ─────────────────────────────────────────────────
import Shimmer from 'components/common/Shimmer';

// ─── Hooks ──────────────────────────────────────────────────────
import { useResolutionTrend, ResolutionTrendData } from '../../../hooks/ticketting-assist';

// ─── Props ──────────────────────────────────────────────────────
interface AverageResolutionTimeProps {
  timeframe?: string;
  orgId?: string;
}

// ────────────────────────────────────────────────────────────────
// Main AverageResolutionTime Component
// ────────────────────────────────────────────────────────────────

export function AverageResolutionTime({ timeframe = '30days', orgId = '' }: AverageResolutionTimeProps) {
  const { data: resolutionTrendData, loading } = useResolutionTrend(orgId, timeframe, 'week');

  // Generate dummy data for demonstration
  const generateDummyData = () => {
    const data = [];
    const today = new Date();
    
    // Generate 4 weeks of data
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      
      // Generate realistic resolution time data with some variation
      const baseResolutionTime = 2.5 + Math.random() * 3; // Between 2.5 and 5.5 hours
      
      data.push({
        period: `Week ${4 - i}`,
        avg_resolution_time: baseResolutionTime,
        index: 4 - i
      });
    }
    
    return data;
  };

  // Transform data for the chart
  const chartData = useMemo(() => {
    // Use dummy data if no real data is available
    const dataToUse = resolutionTrendData && resolutionTrendData.length > 0 ? resolutionTrendData : generateDummyData();
    
    return dataToUse.map((item: ResolutionTrendData, index: number) => ({
      period: item.period,
      avgResolutionTime: item.avg_resolution_time || 0,
      index: index + 1
    }));
  }, [resolutionTrendData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box className="rounded-lg border bg-white p-3 shadow-lg">
          <Text size="2" weight="medium" className="text-gray-700">
            Period: {label}
          </Text>
          <Text size="2" className="text-blue-600">
            Avg Resolution Time: {payload[0].value.toFixed(2)} hours
          </Text>
        </Box>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Box className="mb-6 rounded-lg h-full border bg-white p-4">
        <Box className="mb-4 flex items-start justify-between">
          <Shimmer width="200px" height="24px" />
        </Box>
        <Box className="h-[250px]">
          <Shimmer width="100%" height="100%" />
        </Box>
      </Box>
    );
  }

  // Show no data found if there's no data and no dummy data should be shown
  if (!resolutionTrendData || resolutionTrendData.length === 0) {
    return (
      <Box className="mb-6 rounded-lg h-full border bg-white p-4">
        <Box className="mb-4 flex items-start justify-between">
          <Text size="4" weight="medium">
            Avg Resolution Time Over Period
          </Text>
        </Box>
        <Box className="h-[250px] flex items-center justify-center">
          <Flex direction="column" gapY="2" align="center">
            <Text size="3" color="gray" weight="medium">
              No data found
            </Text>
            <Text size="2" color="gray">
              Resolution time data will appear here when available
            </Text>
          </Flex>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="mb-6 rounded-lg h-full border bg-white p-4">
      <Box className="mb-4 flex items-start justify-between">
        <Text size="4" weight="medium">
          Avg Resolution Time Over Time
        </Text>
      </Box>

      <Box className="h-[250px]">
        <ResponsiveContainer width="105%" height="100%" style={{ marginLeft: "-5%"}}>
          <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="resolutionTimeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8979FF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8979FF" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="index" 
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: '#e0e0e0' }}
              axisLine={{ stroke: '#e0e0e0' }}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: '#e0e0e0' }}
              axisLine={{ stroke: '#e0e0e0' }}
              domain={[0, 'dataMax + 10']}
              tickFormatter={(value) => value.toFixed(2)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="avgResolutionTime"
              stroke="#8979FF"
              strokeWidth={2}
              fill="url(#resolutionTimeGradient)"
              dot={{ fill: '#8979FF', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#8979FF', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}

export default AverageResolutionTime;
