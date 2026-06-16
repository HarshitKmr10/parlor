import React from 'react';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Box, Text } from '@radix-ui/themes';

interface QueriesBarGraphProps {
  data: {
    employee_id: string;
    query_count: number;
  }[];
}

export function QueriesBarGraph({ data }: QueriesBarGraphProps) {
  const chartData = data.map((item, index) => ({
    name: (index + 1).toString(),
    queries: item.query_count,
  }));

  return (
    <Box className="p-4 rounded-lg border bg-white">
      <Text size="4" weight="medium" mb="4">
        Number of Queries raised per employee
      </Text>
      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: -20,
              bottom: 20,
            }}
          >
            <Legend 
              verticalAlign="top" 
              align="right"
              content={({ payload }) => (
                <div className="flex gap-2 mb-4 justify-end">
                  <div className="w-3 h-3 bg-[#818CF8] rounded-sm"></div>
                  <span className="text-sm text-gray-500">Number of issues raised</span>
                </div>
              )}
            />
            <CartesianGrid 
              horizontal={true}
              vertical={false}
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: '#666' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#666' }}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                padding: '8px',
              }}
            />
            <Bar
              dataKey="queries"
              fill="#818CF8"
              radius={[0, 0, 0, 0]}
              background={{ fill: "#F5F3FF" }}
              name="Number of issues raised"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Box>
  );
}