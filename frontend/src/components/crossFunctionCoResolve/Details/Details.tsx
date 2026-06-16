import React from 'react';
import { Box, Flex, Text } from '@radix-ui/themes';
import { IncidentCluster } from 'app/(admin)/cross-functional-coresolve/incidentClusters.full';
import SimilarTickets, { SimilarTicket } from 'components/systemInfo/SimilarTickets';

interface DetailsProps {
  selectedItem: IncidentCluster | null;
}

const Details = ({ selectedItem }: DetailsProps) => {
  if (!selectedItem) {
    return <Box p="3"><Text size="4">No incident selected.</Text></Box>;
  }

  // Map similar_incidents to SimilarTicket[]
  const similarTickets: SimilarTicket[] = (selectedItem.similar_incidents || []).map((inc, idx) => ({
    id: idx,
    ticket_id: inc.Number || '-',
    subject: inc['Short description'] || '-',
    description: inc['Short description'] || '-',
    link: '', // No link available in SimilarIncident
    status: inc['Incident State'] || '-',
    category: inc.Category || '-',
    similarity_score: '', // Not available
    source_table: '', // Not available
    source_type: '', // Not available
    created_on: inc.Created ? new Date(inc.Created) : new Date(),
    priority: '', // Not available
  }));

  return (
    <Box p="3" style={{ backgroundColor: 'var(--color-background)', height: '100%', overflowY: 'auto', maxWidth: '100%' }} className="border-l border-[var(--gray-8)]">
      <Text as="div" size="6" weight="bold" mb="4">
        INCIDENT OVERVIEW
      </Text>
      <Flex direction="column" gap="2">
        <Flex align="center"><Text size="2" weight="bold" style={{ width: 160 }}>Network ID:</Text><Text size="2">{selectedItem['Network ID'] || '-'}</Text></Flex>
        <Flex align="center"><Text size="2" weight="bold" style={{ width: 160 }}>Incident ID:</Text><Text size="2">{selectedItem['Number'] || '-'}</Text></Flex>
        <Flex align="center"><Text size="2" weight="bold" style={{ width: 160 }}>Category:</Text><Text size="2">{selectedItem.Category || '-'}</Text></Flex>
        <Flex align="center"><Text size="2" weight="bold" style={{ width: 160 }}>Sub category:</Text><Text size="2">{selectedItem['Sub category'] || '-'}</Text></Flex>
        <Flex align="center"><Text size="2" weight="bold" style={{ width: 160 }}>Incident State:</Text><Text size="2">{selectedItem['Incident State'] || '-'}</Text></Flex>
        <Flex align="center"><Text size="2" weight="bold" style={{ width: 160 }}>Vendor Name:</Text><Text size="2">{selectedItem['Vendor Name'] || '-'}</Text></Flex>
        <Flex align="center"><Text size="2" weight="bold" style={{ width: 160 }}>Vendor Reference Number:</Text><Text size="2">{selectedItem['Vendor Reference Number'] || '-'}</Text></Flex>
        <Flex align="center"><Text size="2" weight="bold" style={{ width: 160 }}>Updated:</Text><Text size="2">{selectedItem.Updated || '-'}</Text></Flex>
        <Flex align="center"><Text size="2" weight="bold" style={{ width: 160 }}>Resolution:</Text><Text size="2">{selectedItem.Resolution || '-'}</Text></Flex>
        <Flex align="center"><Text size="2" weight="bold" style={{ width: 160 }}>Resolved Time:</Text><Text size="2">{selectedItem['Resolved Time'] || '-'}</Text></Flex>
        <Flex align="center"><Text size="2" weight="bold" style={{ width: 160 }}>Assigned to L2 Group:</Text><Text size="2">{selectedItem['Assigned to L2 Group'] === true ? 'Yes' : selectedItem['Assigned to L2 Group'] === false ? 'No' : '-'}</Text></Flex>
        <Flex align="center"><Text size="2" weight="bold" style={{ width: 160 }}>Channel:</Text><Text size="2">{selectedItem.Channel || '-'}</Text></Flex>
      </Flex>
      <Box mt="5">
        <Text as="div" size="5" weight="bold" mb="2">Similar Tickets</Text>
        <SimilarTickets tickets={similarTickets} />
      </Box>
    </Box>
  );
};

export default Details;