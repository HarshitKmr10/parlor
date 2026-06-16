'use client';

import { Box, Text } from '@radix-ui/themes';
import {
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useEffect, useState } from 'react';
import Shimmer from 'components/common/Shimmer';

interface TicketsGraphCVAProps {
  timeFilter: string;  // Format: "YYYY-MM-DD:YYYY-MM-DD"
  ticketingFunnel?: {
    tickets_created_per_day: Record<string, number>;
    tickets_resolved_per_day: Record<string, number>;
    total_queries: number;
    total_tickets_created: number;
    total_tickets_resolved: number;
  };
  isDataLoading?: boolean;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200">
      <p className="text-sm text-gray-600 mb-2">{label}</p>
      {payload.map((item, index) => {
        const color = item.dataKey === 'created' ? '#5B5BD6' : '#EF5A7A';
        const label = item.dataKey === 'created' ? 'Total Tickets Created' : 'Total Tickets Resolved';
        
        return (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm text-gray-700">
              {label}: {item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export function TicketsGraphCVA({ timeFilter, ticketingFunnel, isDataLoading }: TicketsGraphCVAProps) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (!ticketingFunnel?.tickets_created_per_day || !ticketingFunnel?.tickets_resolved_per_day) return;

    // Parse the date range
    let startDate, endDate;
    if (timeFilter?.includes(':')) {
      const [startDateStr, endDateStr] = timeFilter.split(':');
      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);
    }

    // Get all dates in the range
    const dates = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Format the data for the graph
    const formattedData = dates.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      return {
        date: date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }).toUpperCase(),
        created: ticketingFunnel.tickets_created_per_day[dateStr] || 0,
        resolved: ticketingFunnel.tickets_resolved_per_day[dateStr] || 0
      };
    });

    console.log('Formatted Data:', formattedData); // Debug log
    setData(formattedData);
  }, [ticketingFunnel, timeFilter]);

  if (!data.length && !isDataLoading) {
    return (
      <Box className="p-6 rounded-lg border bg-white">
        <Text size="5" weight="medium" mb="4">
          Tickets Created vs Resolved
        </Text>
        <div className="h-[330px] flex items-center justify-center">
          <Text color="gray">No data available</Text>
        </div>
      </Box>
    );
  }

  return (
    <Box className="p-6 rounded-lg border bg-white">
      <Text size="5" weight="medium" mb="4">
        Tickets Created vs Resolved
      </Text>
      {isDataLoading ? (
        <Shimmer height='330px' />
      ):(
        <ResponsiveContainer width="100%" height={330}>
        <ComposedChart
          data={data}
          margin={{
            top: 10,
            right: 10,
            left: -5,
            bottom: 10,
          }}
        >
          <defs>
            <linearGradient id="createdGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5B5BD6" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#5B5BD6" stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="resolvedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF5A7A" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#EF5A7A" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#E5E7EB"
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6B7280', fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6B7280', fontSize: 12 }}
            tickCount={5}
            allowDecimals={false}
            domain={[0, 'auto']}
          />
          <Area
            type="monotone"
            dataKey="created"
            name="Total Tickets Created"
            stroke="#5B5BD6"
            strokeWidth={2}
            fill="url(#createdGradient)"
            dot={{ r: 4, fill: '#5B5BD6', strokeWidth: 2, stroke: 'white' }}
            activeDot={{ r: 6 }}
          />
          <Area
            type="monotone"
            dataKey="resolved"
            name="Total Tickets Resolved"
            stroke="#EF5A7A"
            strokeWidth={2}
            fill="url(#resolvedGradient)"
            dot={{ r: 4, fill: '#EF5A7A', strokeWidth: 2, stroke: 'white' }}
            activeDot={{ r: 6 }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            content={({ payload }) => (
              <div className="flex justify-center gap-6 mt-4">
                {payload?.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm text-gray-600">
                      {entry.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          />
        </ComposedChart>
      </ResponsiveContainer>
      )}
      
    </Box>
  );
} 