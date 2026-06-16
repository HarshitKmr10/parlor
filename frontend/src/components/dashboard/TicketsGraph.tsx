'use client';

import { Box, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  ComposedChart,
} from 'recharts';
import { useEffect, useState } from 'react';
import Shimmer from 'components/common/Shimmer';

interface TicketsGraphProps {
  timeFilter: string;
  dashboardData: {
    org: {
      users: number;
      kb_collections: number;
      kb_documents: number;
    };
    agent_assist: {
      agent_count: number;
      queries: number;
      tickets_created: number;
      tickets_resolved: number;
      time_spent_by_agent: Record<string, number>;
      chat_sessions: number;
    };
  } | null;
  ticketsByDate: {
    date: string;
    total_tickets: number;
    resolved_tickets: number;
  }[];
  isDataLoading?: boolean;
}

const CustomTooltip = ({ active, payload, label, t }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200">
      <p className="text-sm text-gray-600 mb-2">{label}</p>
      {payload.map((item, index) => {
        const color = item.dataKey === 'created' ? '#5B5BD6' : '#EF5A7A';
        const labelText = item.dataKey === 'created' ? t('dashboard.totalTicketsCreated') : t('dashboard.totalTicketsResolved');
        
        return (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm text-gray-700">
              {labelText}: {item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export function TicketsGraph({ timeFilter, ticketsByDate, isDataLoading }: TicketsGraphProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (!ticketsByDate?.length) return;

    // Parse the date range
    let startDate, endDate;
    if (timeFilter?.includes(':')) {
      const [startDateStr, endDateStr] = timeFilter.split(':');
      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);
    }

    // Format and filter the data
    let formattedData = ticketsByDate.map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }).toUpperCase(),
      created: item.total_tickets || 0,
      resolved: item.resolved_tickets || 0,
      originalDate: new Date(item.date)
    }));

    // Apply date range filter if dates are valid
    if (startDate && endDate) {
      formattedData = formattedData.filter(item => {
        return item.originalDate >= startDate && item.originalDate <= endDate;
      });
    }

    // Sort by date
    formattedData.sort((a, b) => a.originalDate.getTime() - b.originalDate.getTime());

    // Remove the originalDate field before setting the data
    const cleanedData = formattedData.map(({ originalDate, ...rest }) => rest);
    
    console.log('Formatted Data:', cleanedData); // Debug log
    setData(cleanedData);
  }, [ticketsByDate, timeFilter]);

  if (!ticketsByDate?.length) {
    return (
      <Box className="p-6 rounded-lg border bg-white">
        <Text size="5" weight="medium" mb="4">
          {t('dashboard.ticketsCreatedVsResolved')}
        </Text>
        <div className="h-[330px] flex items-center justify-center">
          <Text color="gray">{t('dashboard.noDataAvailable')}</Text>
        </div>
      </Box>
    );
  }

  return (
    <Box className="p-6 rounded-lg border bg-white">
      <Text size="5" weight="medium" mb="4">
        {t('dashboard.ticketsCreatedVsResolved')}
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
              name={t('dashboard.totalTicketsCreated')}
              stroke="#5B5BD6"
              strokeWidth={2}
              fill="url(#createdGradient)"
              dot={{ r: 4, fill: '#5B5BD6', strokeWidth: 2, stroke: 'white' }}
              activeDot={{ r: 6 }}
            />
            <Area
              type="monotone"
              dataKey="resolved"
              name={t('dashboard.totalTicketsResolved')}
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
