'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, Flex } from '@radix-ui/themes';
import SummaryCard from '@/components/copilot/SummaryCard';
import { useCopilotStore } from '@/store/Copilot';
import { useTicketsStore } from '@/store/Tickets/TicketsStore';
import Shimmer from '@/components/common/Shimmer/Shimmer';
import CreateCopilotTicketModal from '@/components/copilot/CreateCopilotTicketModal';
import { useSearchParams } from 'next/navigation';

interface CreatedTicketsProps {
  isVisible: boolean;
}

/**
 * TicketCardSkeleton Component
 * 
 * Shimmer loading skeleton that matches the SummaryCard layout
 */
const TicketCardSkeleton: React.FC = () => {
  return (
    <Box className="rounded-lg border border-[#A7A1D3] bg-[#FAF6FE] p-4">
      {/* Header Section */}
      <Flex justify="between" align="center" className="mb-3">
        <Shimmer height="24px" width="120px" borderRadius="0.375rem" />
        <Shimmer height="16px" width="16px" borderRadius="0.375rem" />
      </Flex>

      {/* Title Section */}
      <Box className="mb-2">
        <Shimmer height="20px" width="100%" borderRadius="0.375rem" className="mb-2" />
        <Shimmer height="16px" width="90%" borderRadius="0.375rem" className="mb-1" />
        <Shimmer height="16px" width="75%" borderRadius="0.375rem" />
      </Box>

      {/* Footer Section */}
      <Flex justify="between" align="center" className="mt-3">
        <Flex align="center" gap="2">
          <Shimmer height="24px" width="100px" borderRadius="0.375rem" />
          <Shimmer height="24px" width="80px" borderRadius="0.375rem" />
        </Flex>
        <Shimmer height="32px" width="120px" borderRadius="0.375rem" />
      </Flex>
    </Box>
  );
};

/**
 * CreatedTickets Component
 * 
 * Displays a list of tickets created after the meeting started.
 * Fetches tickets using the meeting start time as a filter.
 * Refetches whenever the tab becomes visible.
 */
const CreatedTickets: React.FC<CreatedTicketsProps> = ({ isVisible }) => {
  // Get meeting and user details from Copilot store
  const meeting = useCopilotStore((state) => state.meeting);
  const userDetails = useCopilotStore((state) => state.userDetails);
  const searchParams = useSearchParams();
  const meeting_id = searchParams.get('meetingId');
  
  // Get created tickets data and actions from Tickets store
  const createdTickets = useTicketsStore((state) => state.createdTickets);
  const loadingCreatedTickets = useTicketsStore((state) => state.loadingCreatedTickets);
  const fetchCreatedTickets = useTicketsStore((state) => state.fetchCreatedTickets);


  // Track previous visibility state
  const previousVisibleRef = useRef(false);
  
  // Modal state for viewing ticket details
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  // Fetch created tickets when tab becomes visible or when meeting/user details change
  useEffect(() => {
    if (
      isVisible &&
      meeting?.start_timestamp && 
      userDetails?.employeeId
    ) {
      // Refetch if tab just became visible OR if it's the first load
      if (isVisible !== previousVisibleRef.current || !previousVisibleRef.current) {
        fetchCreatedTickets({
          employeeId: userDetails.employeeId,
          mobilePhone: userDetails.mobilePhone,
          fullName: userDetails.fullName,
          email: userDetails.email,
          employeeNumber: userDetails.employeeNumber,
          meetingStartTime: meeting.start_timestamp,
          meetingId: meeting_id || undefined,
        });
      }
    }
    
    // Update previous visibility state
    previousVisibleRef.current = isVisible;
  }, [isVisible, meeting?.start_timestamp, userDetails?.employeeId, userDetails?.mobilePhone, userDetails?.fullName, userDetails?.email, userDetails?.employeeNumber, fetchCreatedTickets, meeting_id]);

  const handleViewTicket = (ticket: any) => {
    setSelectedTicket(ticket);
    setIsTicketModalOpen(true);
  };

  const capitalizeFirst = (value?: string) =>
    value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

  return (
    <Box className="w-full h-full overflow-auto px-4 py-4">
      {/* Header */}
      <Box className="mb-4">
        <Text size="4" weight="bold" className="text-[#0D001A]">
          Created Tickets
        </Text>
        {!loadingCreatedTickets && (
          <Text size="2" className="text-[#646464] ml-2">
            {createdTickets.length} ticket{createdTickets.length !== 1 ? 's' : ''}
          </Text>
        )}
      </Box>

      {/* Tickets List */}
      <Box className="flex flex-col gap-4">
        {loadingCreatedTickets ? (
          // Show shimmer skeletons while loading
          <>
            <TicketCardSkeleton />
            <TicketCardSkeleton />
            <TicketCardSkeleton />
          </>
        ) : createdTickets.length === 0 ? (
          <Box className="text-center py-8">
            <Text size="3" className="text-[#646464]">
              No tickets created during this call yet
            </Text>
          </Box>
        ) : (
          createdTickets.map((ticket) => (
            <SummaryCard
              key={ticket.ticket_number}
              title={ticket.title}
              summary={ticket.description}
              category={capitalizeFirst(ticket.category)}
              onViewTicket={() => handleViewTicket(ticket)}
              ticketAction={'view'}
            />
          ))
        )}
      </Box>

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <CreateCopilotTicketModal
          open={isTicketModalOpen}
          setOpen={setIsTicketModalOpen}
          meetingId={meeting_id || ''}
          prefilledTitle={selectedTicket.title}
          prefilledDescription={selectedTicket.description}
          prefilledCategory={selectedTicket.category}
          prefilledPriority={selectedTicket.priority?.toString()}
          prefilledUrgency={selectedTicket.urgency?.toString()}
          prefilledImpact={selectedTicket.ticket_display_info?.impact?.toString()}
          prefilledWorkNotes={selectedTicket.work_notes}
          viewOnly={true}
          ticketNumber={selectedTicket.ticket_number}
        />
      )}
    </Box>
  );
};

export default CreatedTickets;

