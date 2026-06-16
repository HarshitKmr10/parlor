import React from 'react';
import { Badge, Text } from '@radix-ui/themes';
import { FileText, Users, Clock } from 'lucide-react';

interface InfoCardProps {
  title: string;
  issueCount: number;
  platform: string;
  employeeCount: number;
  kbStatus: string;
  timeToResolution: string;
  onClick?: () => void;
}

const InfoCard: React.FC<InfoCardProps> = ({
  title,
  issueCount,
  platform,
  employeeCount,
  kbStatus,
  timeToResolution,
  onClick,
}) => {
  return (
    <div 
        className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm mb-3 cursor-pointer hover:border-indigo-300 transition-colors duration-150"
        onClick={onClick} 
    >
      <Text size="1" className="text-gray-500 mb-1 block">{issueCount} issues</Text>
      <Text size="2" weight="medium" className="text-gray-800 mb-2 block">{platform}</Text>
      
      {/* Employee Badge - Placeholder styling */}
      <Badge color="orange" variant="soft" radius="full" className="mb-2 text-xs">
        <Users size={12} className="inline mr-1" /> {/* Example icon */}
        {employeeCount} employees
      </Badge>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center">
          <FileText size={12} className="mr-1" />
          {kbStatus}
        </span>
        <span className="flex items-center">
          <Clock size={12} className="mr-1" />
          {timeToResolution}
        </span>
      </div>
    </div>
  );
};

export default InfoCard; 