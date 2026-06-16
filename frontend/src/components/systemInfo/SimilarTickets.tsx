import React from 'react';
import { Box, Flex, Text, ScrollArea, Spinner } from '@radix-ui/themes';
import NoDataIcon from 'components/icons/NoDataIcon';
import TicketCard from './TicketCard';

export interface SimilarTicket {
  id: number;
  ticket_id: string;
  subject: string;
  description: string;
  link: string;
  status: string;
  category: string;
  similarity_score: string;
  source_table: string;
  source_type: string;
  created_on: Date,
  priority: string;
}

interface SimilarTicketsProps {
  tickets: SimilarTicket[];
  loading?: boolean;
  ticketsPerRow?: number;
}

const NoTicketsMessage = React.memo(function NoTicketsMessage() {
  return (
    <Box className="h-full px-2">
      <Flex direction="column" gapY="2" height="100%" justify="center" align="center">
        <NoDataIcon />
        <Text size="1" align="center" className="text-balance text-gray-700">
          No similar tickets found
        </Text>
      </Flex>
    </Box>
  );
});

/**
 * SimilarTickets Component
 * 
 * Displays a grid of similar tickets with configurable layout.
 * Memoized to prevent unnecessary re-renders and preserve state when tab visibility changes.
 */
const SimilarTickets = React.memo(function SimilarTickets({ tickets, loading = false, ticketsPerRow = 1 }: SimilarTicketsProps) {
  if (loading) {
    return (
      <Flex justify="center" align="center" className="h-full">
        <Spinner />
      </Flex>
    );
  }

  if (!tickets || tickets.length === 0) {
    return <NoTicketsMessage />;
  }

  // Calculate grid columns based on ticketsPerRow
  const gridCols = ticketsPerRow === 2 ? 'grid-cols-2' : 'grid-cols-1';
  
  return (
    <ScrollArea className="h-full" style={{ background: 'var(--gray-3)' }}>
      <Box p="3">
        <div className={`grid ${gridCols} gap-3`}>
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} time={''} />
          ))}
        </div>
      </Box>
    </ScrollArea>
  );
});

export default SimilarTickets;



