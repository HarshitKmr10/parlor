'use client';
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'; // Keep if you want to show weekly change

// Props that are actually available from useTicketAssistMetrics
interface ResolutionRateCardProps {
  value: number | null; // Resolution percentage (e.g., 1.54 for 154%)
  change?: number | null; // Weekly percentage change
  loading: boolean;
}

const ResolutionRateCard: React.FC<ResolutionRateCardProps> = ({
  value,
  change,
  loading,
}) => {

  const displayPercentage = value !== null ? Math.round(value * 100) : null;

  const donutData = [
    { name: 'Resolved', value: displayPercentage ?? 0 },
    // If value > 100, "Remaining" will be negative or 0.
    // Recharts Pie with startAngle/endAngle should handle this by showing first segment as full.
    { name: 'Remaining', value: Math.max(0, 100 - (displayPercentage ?? 0)) },
  ];
  const DONUT_COLORS = ['#4F46E5', '#E5E7EB']; // Indigo-600, Gray-200

  // Optional: If you still want to show a simplified change indicator somewhere
  const formatChange = (changeValue: number | null | undefined): { text: string; color: string; Icon: React.ElementType } => {
    if (changeValue === null || changeValue === undefined) {
      return { text: 'N/A', color: 'text-gray-800', Icon: Minus };
    }
    const formatted = Math.abs(changeValue).toFixed(1) + '%';
    if (changeValue > 0) {
      return { text: `+${formatted}`, color: 'text-green-500', Icon: TrendingUp };
    } else if (changeValue < 0) {
      return { text: `-${formatted}`, color: 'text-red-500', Icon: TrendingDown };
    } else {
      return { text: '0.0%', color: 'text-gray-800', Icon: Minus };
    }
  };
  const changeDisplay = formatChange(change);


  if (loading) {
    return (
      <div className="bg-white p-4 rounded-lg shadow flex items-center justify-center h-[150px]">
        Loading...
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow flex flex-col items-center justify-center text-center h-[150px]">
      {/* Donut Chart */}
      <div className="relative w-16 h-16 mb-2"> {/* Smaller donut, margin bottom for title */}
        {displayPercentage !== null ? (
           <>
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius="100%"
                  outerRadius="120%"
                  fill={DONUT_COLORS[0]}
                  paddingAngle={0}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270} // Ensures it draws a full circle effect
                >
                  {/* Only explicitly color the first segment if data ensures it's what fills */}
                  <Cell fill={DONUT_COLORS[0]} strokeWidth={0} />
                  <Cell fill={DONUT_COLORS[1]} strokeWidth={0} /> {/* For the "remaining" part, if any */}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold text-indigo-700">{displayPercentage}%</span> {/* Adjusted text size and color */}
              <span className="text-[10px] text-gray-800 mt-0.5">Resolved</span> {/* Smaller text, slight margin top */}
            </div>
           </>
        ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-800">N/A</div>
        )}
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-indigo-700">Resolution Rate</p> {/* Adjusted title style */}

      {/* Change Indicator */}
      {change !== null && change !== undefined && (
        <div className={`flex items-center text-xs ${changeDisplay.color} mt-1`}> {/* Margin top for spacing */}
            <changeDisplay.Icon size={14} className="mr-0.5" />
            <span>{changeDisplay.text} from last week</span>
        </div>
      )}
    </div>
  );
};

export default ResolutionRateCard; 