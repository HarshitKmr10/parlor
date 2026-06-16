import React from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'; // Import icons (using RefreshCw for cycle)

// Define component props
interface FirstTouchResolutionCardProps {
  value: number | null;
  change: number | null;
  loading: boolean;
}

const FirstTouchResolutionCard: React.FC<FirstTouchResolutionCardProps> = ({ value, change, loading }) => {

  // Format value (percentage) for display
  const formattedValue = value !== null ? `${(value * 100).toFixed(1)}%` : 'N/A';

  // Format change for display (similar to ResolutionRateCard)
  const formatChange = (changeValue: number | null): { text: string; color: string; Icon: React.ElementType } => {
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
     // Basic Loading State (TODO: Improve with skeleton)
     return (
       <div className="bg-white p-6 rounded-lg shadow flex items-center justify-center h-[120px]">
         Loading...
       </div>
     );
   }

  return (
    <div className="bg-white p-6 rounded-lg shadow flex items-center space-x-4 h-[120px]">
      <div className="flex-shrink-0 bg-green-500 p-3 rounded-full shadow">
         <RefreshCw size={28} className="text-white" />
      </div>
      <div className="flex-grow">
        <p className="text-sm text-gray-800 mb-0.5">First Touch Resolution</p>
        <p className="text-3xl font-bold text-gray-800 mb-1">{formattedValue}</p>
        <div className={`flex items-center text-xs ${changeDisplay.color}`}>
            <changeDisplay.Icon size={14} className="mr-1" />
            <span>{changeDisplay.text} from last week</span>
        </div>
      </div>
    </div>
  );
};

export default FirstTouchResolutionCard; 