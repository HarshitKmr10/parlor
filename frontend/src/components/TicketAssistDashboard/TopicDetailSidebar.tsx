'use client';
import React from 'react';
import { Button, Text, Card, Flex, Badge } from '@radix-ui/themes';
import { X, Download, ArrowUp, ArrowDown, Users, Clock } from 'lucide-react';

// Interface for the data expected by the sidebar - ADD EXPORT
export interface TopicDetails {
    topicName: string;        // e.g., "Troubleshoot Software"
    periodInfo: string;     // e.g., "4,131 employee(s) raised..."
    issuesPerEmployee: { value: number; change: number };
    timeToResolution: { value: number; unit: string; change: number };
    firstTouchResolution: { value: number; change: number };
    selectedTopic: {
        name: string;        // e.g., "Microsoft"
        issueCount: number;
        employeeCount: number;
        ttr: string;
    };
    topicExamples: string[];
    ticketsWithoutKbs: {
        id: string;
        title: string;
        ttr: string;
        agent: string;
    }[];
    // Add any other required fields
}

interface TopicDetailSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  topicDetails: TopicDetails | null; // Data to display
}

// Helper to format change percentage
const formatChange = (change: number) => {
    const sign = change > 0 ? '+' : '';
    const color = change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500';
    const Icon = change > 0 ? ArrowUp : change < 0 ? ArrowDown : null;
    return (
        <span className={`ml-1 text-xs inline-flex items-center ${color}`}>
            {Icon && <Icon size={12} className="mr-0.5"/>}
            {sign}{Math.abs(change)}%
        </span>
    );
};

const TopicDetailSidebar: React.FC<TopicDetailSidebarProps> = ({ isOpen, onClose, topicDetails }) => {
  if (!isOpen || !topicDetails) {
    return null;
  }

  return (
    // Overlay and Positioning
    <div className={`fixed inset-0 bg-black bg-opacity-30 z-40 transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <Flex justify="between" align="center" p="3" className="border-b">
          <Text weight="medium" size="3">{topicDetails.topicName}</Text>
          <Flex gap="2">
              <Button variant="ghost" size="1" color="gray" className="cursor-pointer">
                  <Download size={16} />
              </Button>
              <Button variant="ghost" size="1" color="gray" onClick={onClose} className="cursor-pointer">
                  <X size={16} />
              </Button>
          </Flex>
        </Flex>

        {/* Content Area (Scrollable) */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4">
            {/* Period Info */}
            <Text size="2" className="text-gray-600">{topicDetails.periodInfo}</Text>
            
            {/* KPIs */}
            <Flex gap="4" align="start" className="text-center">
                <div>
                    <Text size="4" weight="bold">{topicDetails.issuesPerEmployee.value}</Text>
                    {formatChange(topicDetails.issuesPerEmployee.change)}
                    <Text size="1" color="gray" className="block mt-1">Issues Per Employee</Text>
                </div>
                 <div>
                    <Text size="4" weight="bold">{topicDetails.timeToResolution.value}<span className='text-lg'>{topicDetails.timeToResolution.unit}</span></Text>
                    {formatChange(topicDetails.timeToResolution.change)}
                    <Text size="1" color="gray" className="block mt-1">Time To Resolution</Text>
                </div>
                 <div>
                    <Text size="4" weight="bold">{topicDetails.firstTouchResolution.value}%</Text>
                     {formatChange(topicDetails.firstTouchResolution.change)}
                   <Text size="1" color="gray" className="block mt-1">First Touch Resolution</Text>
                </div>
            </Flex>
            
            {/* Selected Topic Details */}
            <Card size="1">
                 <Flex justify="between" align="center" mb="2">
                     <Text weight="medium">Topic</Text>
                     {/* Add collapse/expand icon if needed */}
                 </Flex>
                 <Text weight="medium" size="3" className="block mb-1">{topicDetails.selectedTopic.name}</Text>
                 <Flex gap="3" align="center" className="text-xs text-gray-600 mb-3">
                      <span>{topicDetails.selectedTopic.issueCount} issues</span>
                      <span>{topicDetails.selectedTopic.employeeCount} employees</span>
                      <span>{topicDetails.selectedTopic.ttr}</span>
                 </Flex>
                 
                 {/* Topic Examples */}
                 <Card variant='surface' size="1">
                    <Flex justify="between" align="center" mb="2">
                         <Text weight="medium" size="2">Topic Examples</Text>
                         <Button variant="ghost" size="1" color="gray" className="cursor-pointer">
                             <Download size={14} />
                         </Button>
                     </Flex>
                     <ul className="list-none space-y-1 text-sm text-gray-700">
                         {topicDetails.topicExamples.map((example, index) => (
                            <li key={index}>{example}</li>
                         ))}
                     </ul>
                 </Card>
            </Card>
            
            {/* Tickets without KBs */}
             <div>
                 <Flex align="center" gap="2" mb="2">
                     <Text weight="medium" size="2">Tickets without KBs</Text>
                     <Badge color="gray" radius="full">{topicDetails.ticketsWithoutKbs.length}</Badge>
                 </Flex>
                  <div className="space-y-2">
                     {topicDetails.ticketsWithoutKbs.map(ticket => (
                        <Card key={ticket.id} size="1">
                           <Text size="2" weight="medium" className="block mb-1">INC{ticket.id}</Text>
                           <Text size="2" className="block text-gray-700 mb-2">{ticket.title}</Text>
                           <Flex justify="between" align="center" className="text-xs text-gray-500">
                               <span className="flex items-center"><Clock size={12} className="mr-1" /> {ticket.ttr}</span>
                               <Badge variant="soft" radius="full"><Users size={12} className="mr-1" /> {ticket.agent}</Badge>
                           </Flex>
                        </Card>
                     ))}
                 </div>
             </div>

        </div>
      </div>
    </div>
  );
};

export default TopicDetailSidebar; 