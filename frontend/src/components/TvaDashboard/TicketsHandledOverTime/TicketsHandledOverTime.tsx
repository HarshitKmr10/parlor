'use client';

// ─── Imports ─────────────────────────────────────────────────────
import { useMemo } from 'react';
import { Box, Text, Flex } from '@radix-ui/themes';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend } from 'recharts';

// ─── Components ─────────────────────────────────────────────────
import Shimmer from 'components/common/Shimmer';

// ─── Hooks ──────────────────────────────────────────────────────
import { useTicketHandledOvertime, TicketHandledData } from '../../../hooks/ticketting-assist';

// ─── Props ──────────────────────────────────────────────────────
interface TicketsHandledOverTimeProps {
  timeframe?: string;
  orgId?: string;
}

// ────────────────────────────────────────────────────────────────
// Main TicketsHandledOverTime Component
// ────────────────────────────────────────────────────────────────

export function TicketsHandledOverTime({ timeframe = '30days', orgId = '' }: TicketsHandledOverTimeProps) {
  const { data: ticketHandledData, loading } = useTicketHandledOvertime(orgId, timeframe, 'day');

  // Generate dummy data for demonstration
  const generateDummyData = () => {
    const data = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Generate realistic ticket data with some variation
      const baseCreated = 15 + Math.floor(Math.random() * 20);
      const baseResolved = Math.max(0, baseCreated - Math.floor(Math.random() * 8));
      
      data.push({
        date: date.toISOString().split('T')[0],
        created: baseCreated,
        resolved: baseResolved,
        index: 30 - i
      });
    }
    
    return data;
  };

  // Transform data for the chart
  const chartData = useMemo(() => {
    // Use dummy data if no real data is available
    const dataToUse = ticketHandledData && ticketHandledData.length > 0 ? ticketHandledData : generateDummyData();
    
    return dataToUse.map((item: TicketHandledData, index: number) => ({
      date: item.date,
      created: item.created,
      resolved: item.resolved,
      index: index + 1,
      // Format date for display (e.g., "Sep 10", "Sep 12")
      displayDate: new Date(item.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
    }));
  }, [ticketHandledData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box className="rounded-lg border bg-white p-3 shadow-lg">
          <Text size="2" weight="medium" className="text-gray-700">
            Date: {label}
          </Text>
          {payload.map((entry: any, index: number) => (
            <Text key={index} size="2" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </Text>
          ))}
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
  if (!ticketHandledData || ticketHandledData.length === 0) {
    return (
      <Box className="mb-6 rounded-lg h-full border bg-white p-4">
        <Box className="mb-4 flex items-start justify-between">
          <Text size="4" weight="medium">
            Tickets Handled Over Time
          </Text>
        </Box>
        <Box className="h-[250px] flex items-center justify-center">
          <Flex direction="column" gapY="2" align="center">
            <Text size="3" color="gray" weight="medium">
              No data found
            </Text>
            <Text size="2" color="gray">
              Ticket data will appear here when available
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
          Tickets Handled Over Time
        </Text>
      </Box>

      <Box className="h-[250px]">
        <ResponsiveContainer width="105%" height="100%" style={{ marginLeft: "-5%"}}>
          <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="createdGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8979FF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8979FF" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="resolvedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="displayDate" 
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: '#e0e0e0' }}
              axisLine={{ stroke: '#e0e0e0' }}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: '#e0e0e0' }}
              axisLine={{ stroke: '#e0e0e0' }}
              domain={[0, 'dataMax + 5']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area
              type="monotone"
              dataKey="created"
              stackId="1"
              stroke="#8979FF"
              strokeWidth={2}
              fill="url(#createdGradient)"
              name="Created"
              dot={{ fill: '#8979FF', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, stroke: '#8979FF', strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="resolved"
              stackId="2"
              stroke="#10B981"
              strokeWidth={2}
              fill="url(#resolvedGradient)"
              name="Resolved"
              dot={{ fill: '#10B981', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, stroke: '#10B981', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}

export default TicketsHandledOverTime;
