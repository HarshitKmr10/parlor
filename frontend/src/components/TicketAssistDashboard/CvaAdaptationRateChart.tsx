'use client';
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DailyBotUsageData } from '../../hooks/ticket-assist/useDailyBotUsage'; // Import data type

// Define component props
interface CvaAdaptationRateChartProps {
  data: DailyBotUsageData[];
  loading: boolean;
}

// REMOVE Mock data generation
// const generateMockData = () => { ... };
// const mockData = generateMockData();

const CvaAdaptationRateChart: React.FC<CvaAdaptationRateChartProps> = ({ data, loading }) => {

  if (loading) {
    // TODO: Replace with a proper skeleton loader
    return (
      <div className="bg-white p-4 rounded-lg shadow h-[352px] flex flex-col items-center justify-center">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">CVA Adaptation Rate</h3>
        <div>Loading Chart...</div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow h-full">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">CVA Adaptation Rate</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={data} // Use data from props
          margin={{
            top: 5, right: 30, left: 0, bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          {/* Use formatted date for XAxis */}
          <XAxis dataKey="date" /> 
          {/* Y-axis represents percentage rate */}
          <YAxis domain={[0, 100]} unit="%" /> 
          <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
          {/* Use rate for Line dataKey */}
          <Line type="monotone" dataKey="rate" stroke="#8884d8" strokeWidth={2} dot={false} activeDot={{ r: 6 }}/> 
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CvaAdaptationRateChart; 