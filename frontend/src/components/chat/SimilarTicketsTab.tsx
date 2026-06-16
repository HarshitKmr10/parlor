import React from 'react';
import { Tabs } from '@radix-ui/themes';
import SimilarTickets, { SimilarTicket } from 'components/systemInfo/SimilarTickets';


interface SimilarTicketsTabProps {
  tickets: SimilarTicket[];
  loading?: boolean;
}

function SimilarTicketsTab({
  tickets,
  loading = false,
}: SimilarTicketsTabProps) {
  return (
    <Tabs.Content value="similarTickets" className="overflow-y-hidden h-full">
      <SimilarTickets tickets={tickets} loading={loading} />
    </Tabs.Content>
  );
}

export default SimilarTicketsTab; 