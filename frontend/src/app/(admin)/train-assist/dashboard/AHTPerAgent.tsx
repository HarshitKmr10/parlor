import React from 'react';
import {
  Box,
  Flex,
  Text,
  Table,
  Select,
  Tooltip,
  IconButton,
} from '@radix-ui/themes';
import { InfoCircledIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { Sparklines, SparklinesLine } from 'react-sparklines';

interface Agent {
  name: string;
  aht: string;
  lastSixMonths: number[];
}

interface AHTPerAgentProps {
  agents: Agent[];
  categories: string[];
}
function AHTPerAgent({ agents, categories }: AHTPerAgentProps) {
  return (
    <Box className="bg-white p-4 rounded-lg shadow-sm h-full">
      <Flex justify="between" align="center" mb="4">
        <Flex align="center" gap="2">
          <Text size="5" weight="bold">
            AHT per Agent
          </Text>
          <Tooltip content="Average Hourly Time (AHT) per Agent">
            <IconButton size="1" variant="ghost">
              <InfoCircledIcon />
            </IconButton>
          </Tooltip>
        </Flex>
        <Select.Root defaultValue="software">
          <Select.Trigger />
          <Select.Content>
            {categories.map((category) => (
              <Select.Item key={category} value={category.toLowerCase()}>
                {category}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Flex>

      <Box
        className="overflow-y-auto"
        style={{ minHeight: '300px', maxHeight: '300px' }}
      >
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>
                <Text size="2" color="gray">
                  Agent Name
                </Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" color="gray">
                  AHT
                </Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" color="gray">
                  Last 6 months
                </Text>
              </Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {agents.map((agent) => (
              <Table.Row key={agent.name}>
                <Table.Cell>{agent.name}</Table.Cell>
                <Table.Cell>{agent.aht}</Table.Cell>
                <Table.Cell>{/* Sparklines code can go here */}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  );
}

export default AHTPerAgent;
