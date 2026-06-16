'use client';
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ModulePerformanceData {
  name: string;
  topicsCompleted: number;
  avgQuizScore: number;
  simulationsCompleted: number;
}

interface ModulesPerformanceSummaryChartProps {
  data: ModulePerformanceData[] | null;
  loading: boolean;
}

const ModulesPerformanceSummaryChart: React.FC<ModulesPerformanceSummaryChartProps> = ({
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
    const allValues = chartData.flatMap(item => [
      item.topicsCompleted,
      item.avgQuizScore,
      item.simulationsCompleted
    ]);
    const max = Math.max(...allValues);
    const result = Math.ceil(max / 10) * 10;
    
    return result;
  }, [chartData]);

  

  if (loading) {
    return (
      <div className="bg-white p-4 rounded-lg shadow h-full flex flex-col items-center justify-center">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Modules Performance Summary</h3>
        <div>Loading Chart...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-4 rounded-lg shadow h-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-700">Modules Performance Summary</h3>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1">
              <span className="w-3 h-3 bg-[#4F46E5] rounded-full"></span>
              <span className="text-gray-600">Topics Completed</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-3 h-3 bg-[#F87171] rounded-full"></span>
              <span className="text-gray-600">Quiz Avg Score</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-3 h-3 bg-[#14B8A6] rounded-full"></span>
              <span className="text-gray-600">Simulations Completed</span>
            </div>
          </div>
        </div>
        <div className="h-[300px] flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-lg mb-2">No performance data available</p>
            <p className="text-gray-400 text-sm">Data will appear here when quiz performance is recorded</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-700">Modules Performance Summary</h3>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-1">
            <span className="w-3 h-3 bg-[#4F46E5] rounded-full"></span>
            <span className="text-gray-600">Topics Completed</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-3 h-3 bg-[#F87171] rounded-full"></span>
            <span className="text-gray-600">Quiz Avg Score</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-3 h-3 bg-[#14B8A6] rounded-full"></span>
            <span className="text-gray-600">Simulations Completed</span>
          </div>
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
          <Bar dataKey="topicsCompleted" fill="#4F46E5" radius={[2, 2, 0, 0]} />
          <Bar dataKey="avgQuizScore" fill="#F87171" radius={[2, 2, 0, 0]} />
          <Bar dataKey="simulationsCompleted" fill="#14B8A6" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ModulesPerformanceSummaryChart; 