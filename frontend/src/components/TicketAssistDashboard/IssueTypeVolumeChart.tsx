'use client';
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { IssueTypeVolumeData } from '../../hooks/ticket-assist/useIssueTypeVolume'; // Import data type

// Define component props
interface IssueTypeVolumeChartProps {
  data: IssueTypeVolumeData[];
  loading: boolean;
}

// Mock data - REMOVE
// const data = [...];

// Calculate total based on PROPS - UPDATED
// const totalValue = data.reduce((sum, entry) => sum + entry.value, 0); // Calculate dynamically inside component

// UPDATED COLORS (Keep)
const COLORS = ['#A78BFA', '#F97316', '#EF4444', '#22D3EE', '#6B7280']; 

// Custom Tooltip - UPDATED to accept totalValue as prop
const CustomTooltip = ({ active, payload, totalValue }: any) => {
  if (active && payload && payload.length) {
    const entry = payload[0].payload;
    const valueFormatted = entry.value.toLocaleString('en-US');
    // Handle potential division by zero if totalValue is 0
    const percentageFormatted = totalValue > 0 ? ((entry.value / totalValue) * 100).toFixed(1) : '0.0'; 
    return (
      <div className="bg-white p-2 shadow rounded border border-gray-200 text-sm">
        <p className="font-semibold">{`${entry.name}`}</p>
        <p className="text-gray-600">{`${valueFormatted} (${percentageFormatted}%)`}</p>
      </div>
    );
  }
  return null;
};

// Custom Legend Formatter - UPDATED to accept data and totalValue as props
const renderLegend = (props: any, data: IssueTypeVolumeData[], totalValue: number) => {
  const { payload } = props;

  return (
    // Use style from user edits
    <ul className="flex flex-col space-y-1" style={{ paddingLeft: '20px', paddingRight: '15px' }}> 
      {payload.map((entry: any, index: number) => {
        // Find original data entry using the name from the legend payload
        const item = data.find(d => d.name === entry.value); 
        if (!item) return null;

        const valueFormatted = item.value.toLocaleString('en-US');
        // Handle potential division by zero
        const percentageFormatted = totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : '0.0';
        
        return (
          <li key={`item-${index}`} className="flex items-center text-sm">
            <span 
              className="w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: entry.color }}
            ></span>
            <span className="text-gray-700 mr-2">{item.name}</span>
            <span className="text-gray-500">{valueFormatted}</span>
            <span className="text-gray-500 ml-1">{percentageFormatted}%</span>
          </li>
        );
      })}
    </ul>
  );
};


const IssueTypeVolumeChart: React.FC<IssueTypeVolumeChartProps> = ({ data, loading }) => {

  // Calculate total dynamically from props
  const totalValue = React.useMemo(() => data.reduce((sum, entry) => sum + entry.value, 0), [data]);

  if (loading) {
    // TODO: Replace with a proper skeleton loader
    return (
       <div className="bg-white p-4 rounded-lg shadow h-full flex flex-col items-center justify-center">
         <h3 className="text-lg font-semibold text-gray-700 mb-4">Issue Type by Volume</h3>
         <div>Loading Chart...</div>
       </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow h-full flex flex-col">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">Issue Type by Volume</h3>
      <div className="flex-grow flex items-center justify-center relative">
          {/* Centered Text - Use totalValue calculated from props */}
          {/* Use user edited centering approach */}
          <div className="absolute flex flex-col items-center justify-center pointer-events-none">
             <span className="text-3xl font-bold text-gray-800 tracking-tight pl-30 pr-60"> 
               {totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
             </span>
          </div>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data} // Use data from props
              cx="50%"
              cy="50%"
              labelLine={false}
              innerRadius="65%" 
              outerRadius="85%"
              fill="#8884d8"
              paddingAngle={3} 
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
              ))}
            </Pie>
             {/* Pass totalValue to custom tooltip */}
            <Tooltip content={<CustomTooltip totalValue={totalValue}/>} cursor={{ fill: 'transparent' }}/> 
            <Legend 
               // Pass data and totalValue to legend formatter
              content={(props) => renderLegend(props, data, totalValue)} 
              layout="vertical"
              verticalAlign="middle"
              align="right"
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default IssueTypeVolumeChart; 