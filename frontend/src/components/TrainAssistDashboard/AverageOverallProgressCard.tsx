'use client';
import React from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';

interface AverageOverallProgressCardProps {
  value: number | null; // Progress as percentage (e.g., 78.5 for 78.5%)
  change?: number | null | undefined;
  loading: boolean;
}

const AverageOverallProgressCard: React.FC<AverageOverallProgressCardProps> = ({
  value,
  change,
  loading,
}) => {
  const formattedValue = value !== null ? `${Math.round(value)}%` : 'N/A';

  const formatChange = (changeValue: number | null | undefined): { text: string; color: string; Icon: React.ElementType } => {
    if (typeof changeValue !== 'number' || isNaN(changeValue)) {
      return { text: 'N/A', color: 'text-gray-800', Icon: Minus };
    }
    const percentage = Math.abs(changeValue * 100).toFixed(1) + '%';
    if (changeValue > 0) {
      return { text: `+${percentage}`, color: 'text-green-500', Icon: TrendingUp };
    } else if (changeValue < 0) {
      return { text: `-${percentage}`, color: 'text-red-500', Icon: TrendingDown };
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
      <div className="flex-shrink-0 bg-purple-500 p-3 rounded-full shadow">
        <BarChart3 size={28} className="text-white" />
      </div>
      <div className="flex-grow">
        <p className="text-sm text-gray-800 mb-0.5">Average Overall Progress</p>
        <p className="text-3xl font-bold text-gray-800 mb-1">{formattedValue}</p>
        <div className={`flex items-center text-xs ${changeDisplay.color}`}>
          <changeDisplay.Icon size={14} className="mr-1" />
          <span>{changeDisplay.text} from last week</span>
        </div>
      </div>
    </div>
  );
};

export default AverageOverallProgressCard; 