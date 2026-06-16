import React from 'react';
import { Flex, Text } from '@radix-ui/themes';
import { HiClock } from 'react-icons/hi2';

interface SimilarTicketItemProps {
  ticket: {
    number: string;
    short_description: string;
    description: string;
    state: string;
    priority: string;
    category: string;
    work_notes: string;
    close_notes: string;
    resolution_code: string;
    source_table: string;
    opened_at: string;
    closed_at: string;
    assignment_group: string;
    assigned_to: string;
    caller_id: string;
    sys_id: string;
  };
}

function SimilarTicketItem({ ticket }: SimilarTicketItemProps) {
  const getStatusColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'in progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'new':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="border-b border-gray-200 py-2">
      <Flex justify="between" align="start" gap="3">
        {/* Left side - Ticket description */}
        <div className="flex-1 min-w-0">
          <Text size="1" weight="medium" className="text-gray-900 leading-tight">
            {ticket.short_description}
          </Text>
        </div>

        {/* Right side - Status and Date */}
        <Flex align="center" gap="2" className="flex-shrink-0">
          {/* Status pill */}
          <span 
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium text-[#19213D] ${getStatusColor(ticket.state)}`}
            style={{ boxShadow: '0px 1px 3px 0px #19213D1A' }}
          >
            {ticket.state}
          </span>
          
          {/* Date with clock icon */}
          {!!ticket.opened_at && (
            <Flex align="center" gap="1" className="text-xs text-gray-500">
              <HiClock className="w-3 h-3" />
              <span>{formatDate(ticket.opened_at)}</span>
            </Flex>
          )}
        </Flex>
      </Flex>
    </div>
  );
}

export default SimilarTicketItem;
