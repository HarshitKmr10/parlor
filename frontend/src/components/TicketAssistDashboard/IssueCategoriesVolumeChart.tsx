'use client';
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { IssueCategory } from './TopFilterBar'; 

interface IssueCategoriesVolumeChartProps {
  data: IssueCategory[]; 
  loading: boolean;
}


const IssueCategoriesVolumeChart: React.FC<IssueCategoriesVolumeChartProps> = ({ data, loading }) => {

  const chartData = React.useMemo(() => data.filter(cat => cat.name !== 'All Categories'), [data]);

  const maxValue = React.useMemo(() => {
    if (chartData.length === 0) return 100; 
    const max = Math.max(...chartData.map(item => item.issues));
    return Math.ceil(max / 10) * 10; 
  }, [chartData]);


  if (loading) {
     // TODO: Replace with a proper skeleton loader
     return (
       <div className="bg-white p-4 rounded-lg shadow h-full flex flex-col items-center justify-center">
         <h3 className="text-lg font-semibold text-gray-700 mb-4">Issue Categories by Volume</h3>
         <div>Loading Chart...</div>
       </div>
     );
   }

  return (
    <div className="bg-white p-4 rounded-lg shadow h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-700">Issue Categories by Volume</h3>
        <div className="flex items-center space-x-2">
           <span className="w-3 h-3 bg-[#8884d8] rounded-full"></span>
           <span className="text-sm text-gray-600">Total Issues</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData} // Use filtered data from props
          margin={{
            top: 5, right: 30, left: 0, bottom: 5,
          }}
          barGap={10} 
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false}/>
          <XAxis dataKey="name" />
          <YAxis domain={[0, maxValue]}/> {/* Dynamic Y-axis */} 
          <Tooltip />
          {/* Update dataKey to match IssueCategory interface */}
          <Bar dataKey="issues" fill="#8884d8" radius={[4, 4, 0, 0]} /> 
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default IssueCategoriesVolumeChart; 