import React from 'react';
import { TrendingUp, TrendingDown, Minus, MessageSquare } from 'lucide-react'; // Import icons

// Define component props
interface IssuesPerEmployeeCardProps {
  value: number | null | undefined;
  change: number | null | undefined; // This is a percentage like 0.40 for +40%
  loading: boolean;
}

const IssuesPerEmployeeCard: React.FC<IssuesPerEmployeeCardProps> = ({ value, change, loading }) => {
  const formattedValue = typeof value === 'number' && !isNaN(value) ? value.toFixed(1) : 'N/A';

  const formatChange = (changeValue: number | null | undefined): { text: string; color: string; Icon: React.ElementType } => {
    if (typeof changeValue !== 'number' || isNaN(changeValue)) {
      return { text: 'N/A', color: 'text-gray-800', Icon: Minus };
    }
    // Assuming changeValue is like 0.40 for 40%. Convert to percentage string.
    const percentage = Math.abs(changeValue * 100).toFixed(1) + '%';
    if (changeValue > 0) {
      // More issues per employee is generally negative for this metric
      return { text: `+${percentage}`, color: 'text-red-500', Icon: TrendingUp };
    } else if (changeValue < 0) {
      // Fewer issues per employee is generally positive
      return { text: `-${percentage}`, color: 'text-green-500', Icon: TrendingDown };
    } else {
      return { text: '0.0%', color: 'text-gray-800', Icon: Minus };
    }
  };

  const changeDisplay = formatChange(change);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow flex items-center justify-center h-[120px]">
        Loading...
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow flex items-center space-x-4 h-[120px]">
      <div className="flex-shrink-0 bg-yellow-400 p-3 rounded-full shadow">
        <MessageSquare size={28} className="text-white" />
      </div>
      <div className="flex-grow">
        <p className="text-sm text-gray-800 mb-0.5">Issues Per Employee</p>
        <p className="text-3xl font-bold text-gray-800 mb-1">{formattedValue}</p>
        <div className={`flex items-center text-xs ${changeDisplay.color}`}>
          <changeDisplay.Icon size={14} className="mr-1" />
          <span>{changeDisplay.text} from last week</span>
        </div>
      </div>
    </div>
  );
};

export default IssuesPerEmployeeCard; 