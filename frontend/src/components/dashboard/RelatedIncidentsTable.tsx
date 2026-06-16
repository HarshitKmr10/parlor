import React from 'react';
import {
  Box, Table, Text, Flex, Badge,
} from '@radix-ui/themes';
import { PiTicketFill } from 'react-icons/pi';

const RelatedIncidentsTable: React.FC<{
  tickets: any[];
}> = React.memo(({ tickets }) => (
    <Box>
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>
              <Text size="2" weight="medium" color="gray">Ticket ID</Text>
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>
              <Text size="2" weight="medium" color="gray">Ticket Description</Text>
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>
              <Text size="2" weight="medium" color="gray">Category</Text>
            </Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {tickets.map((ticket) => (
            <Table.Row key={ticket.incident_number} className="hover:bg-gray-50">
              <Table.Cell>
                <Flex align="center" gap="2">
                  <Badge size="2" color="gray" variant="outline" radius="medium">
                    <PiTicketFill className="text-[var(--iris-11)]" size={16} />
                    {ticket.incident_number}
                  </Badge>
                </Flex>
              </Table.Cell>
              <Table.Cell>
                <Text size="2" className="line-clamp-1">
                  {ticket.short_description}
                </Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{ticket.category}</Text>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
));

export default RelatedIncidentsTable;
