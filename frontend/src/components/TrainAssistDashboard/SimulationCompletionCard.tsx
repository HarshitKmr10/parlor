'use client';
import React from 'react';
import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';

interface AverageAttemptsToPassQuizCardProps {
  value: number | null; // Average attempts as a number (e.g., 2.5)
  change?: number | null | undefined;
  loading: boolean;
}

const AverageAttemptsToPassQuizCard: React.FC<AverageAttemptsToPassQuizCardProps> = ({
  value,
  change,
  loading,
}) => {
  const formattedValue = value !== null ? value.toFixed(1) : 'N/A';

  const formatChange = (changeValue: number | null | undefined): { text: string; color: string; Icon: React.ElementType } => {
    if (typeof changeValue !== 'number' || isNaN(changeValue)) {
      return { text: 'N/A', color: 'text-gray-800', Icon: Minus };
    }
    const percentage = Math.abs(changeValue * 100).toFixed(1) + '%';
    if (changeValue > 0) {
      // Higher attempts is negative (bad)
      return { text: `+${percentage}`, color: 'text-red-500', Icon: TrendingUp };
    } else if (changeValue < 0) {
      // Lower attempts is positive (good)
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
      <div className="flex-shrink-0 bg-orange-500 p-3 rounded-full shadow">
        <Target size={28} className="text-white" />
      </div>
      <div className="flex-grow">
        <p className="text-sm text-gray-800 mb-0.5">Average Attempts to Pass Quiz</p>
        <p className="text-3xl font-bold text-gray-800 mb-1">{formattedValue}</p>
        <div className={`flex items-center text-xs ${changeDisplay.color}`}>
          <changeDisplay.Icon size={14} className="mr-1" />
          <span>{changeDisplay.text} from last week</span>
        </div>
      </div>
    </div>
  );
};

export default AverageAttemptsToPassQuizCard; 