import React from 'react';
import { TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react'; // Import icons

// Define component props
interface TimeToResolutionCardProps {
  value: number | null | undefined; // Explicitly allow undefined for clarity
  change: number | null | undefined; // Explicitly allow undefined for clarity
  loading: boolean;
}

const TimeToResolutionCard: React.FC<TimeToResolutionCardProps> = ({ value, change, loading }) => {

  // Format value (hours) for display
  const formattedValue = typeof value === 'number' && !isNaN(value) ? `${value.toFixed(1)}hr` : 'N/A';

  // Format change for display (similar to ResolutionRateCard)
  const formatChange = (changeValue: number | null | undefined): { text: string; color: string; Icon: React.ElementType } => {
      if (changeValue === null || changeValue === undefined) {
        return { text: 'N/A', color: 'text-gray-800', Icon: Minus };
      }
      const formatted = Math.abs(changeValue).toFixed(1) + '%';
      if (changeValue > 0) {
          // Note: Increase in time is usually considered negative/bad
        return { text: `+${formatted}`, color: 'text-red-500', Icon: TrendingUp }; 
      } else if (changeValue < 0) {
          // Decrease in time is positive/good
        return { text: `-${formatted}`, color: 'text-green-500', Icon: TrendingDown }; 
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
      {/* Icon styling based on the second image (blue/purple background for TTR) */}
      <div className="flex-shrink-0 bg-indigo-500 p-3 rounded-full shadow"> {/* Changed to indigo, adjust padding */}
        <Clock size={28} className="text-white" /> {/* Larger icon, white color */}
      </div>
      <div className="flex-grow">
        <p className="text-sm text-gray-800 mb-0.5">Time To Resolution</p>
        <p className="text-3xl font-bold text-gray-800 mb-1">{formattedValue}</p>
        <div className={`flex items-center text-xs ${changeDisplay.color}`}>
          <changeDisplay.Icon size={14} className="mr-1" />
          <span>{changeDisplay.text} from last week</span>
        </div>
      </div>
    </div>
  );
};

export default TimeToResolutionCard; 