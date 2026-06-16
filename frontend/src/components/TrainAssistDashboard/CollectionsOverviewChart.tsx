'use client';
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CollectionData {
  name: string;
  total_topics: number;
}

interface CollectionsOverviewChartProps {
  data: CollectionData[] | null;
  loading: boolean;
}

const CollectionsOverviewChart: React.FC<CollectionsOverviewChartProps> = ({
  data,
  loading,
}) => {
  
  const chartData = React.useMemo(() => {
    const result = data || [];
    return result;
  }, [data]);

  const maxValue = React.useMemo(() => {
    if (chartData.length === 0) {
      return 100; 
    }
    const max = Math.max(...chartData.map(item => item.total_topics));
    const result = Math.ceil(max / 10) * 10;
    return result;
  }, [chartData]);


  if (loading) {
    return (
      <div className="bg-white p-4 rounded-lg shadow h-full flex flex-col items-center justify-center">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Collections Overview</h3>
        <div className="animate-pulse">Loading Chart...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-4 rounded-lg shadow h-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-700">Collections Overview</h3>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 bg-[#4F46E5] rounded-full"></span>
            <span className="text-sm text-gray-600">Completion %</span>
          </div>
        </div>
        <div className="h-[300px] flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-lg mb-2">No collection data available</p>
            <p className="text-gray-400 text-sm">Data will appear here when topics are completed</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-700">Collections Overview</h3>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 bg-[#4F46E5] rounded-full"></span>
          <span className="text-sm text-gray-600">Completion %</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{
            top: 5, right: 30, left: 0, bottom: 5,
          }}
          barGap={10} 
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false}/>
          <XAxis dataKey="name" tick={false} />
          <YAxis domain={[0, maxValue]}/>
          <Tooltip />
          <Bar dataKey="completion" fill="#4F46E5" radius={[4, 4, 0, 0]} /> 
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CollectionsOverviewChart; 