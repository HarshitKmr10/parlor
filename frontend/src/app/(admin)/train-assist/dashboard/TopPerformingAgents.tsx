import React from 'react';
import {
  Box,
  Flex,
  Text,
  Table,
  Select,
  Button,
  Progress,
  Tooltip,
  IconButton,
} from '@radix-ui/themes';
import { InfoCircledIcon } from '@radix-ui/react-icons';

interface Agent {
  name: string;
  completionRate: number;
  avgQuizScore: number;
}

interface TopPerformingAgentsProps {
  agents: Agent[];
  categories: string[];
}

function TopPerformingAgents({
  agents,
  categories,
}: TopPerformingAgentsProps) {
  return (
    <Box className="bg-white p-4 rounded-lg shadow-sm h-full">
      <Flex justify="between" align="center" mb="4">
        <Flex align="center" gap="2">
          <Text size="5" weight="bold">
            Top Performing Agents
          </Text>
          <Tooltip content="Top Performing Agents">
            <IconButton size="1" variant="ghost">
              <InfoCircledIcon />
            </IconButton>
          </Tooltip>
        </Flex>
        <Select.Root defaultValue="all">
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="all">All Categories</Select.Item>
            {categories.map((category) => (
              <Select.Item key={category} value={category}>
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
              <Table.ColumnHeaderCell>Agent Name</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Completion Rate</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Avg. Quiz Scores</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {agents.map((agent) => (
              <Table.Row key={agent.name}>
                <Table.Cell>{agent.name}</Table.Cell>
                <Table.Cell>
                  <Flex align="center" gap="2">
                    <Box style={{ width: '120px' }}>
                      <Progress
                        value={agent.completionRate}
                        className="w-full"
                      />
                    </Box>
                    <Text>
                      {agent.completionRate}
                      %
                    </Text>
                  </Flex>
                </Table.Cell>
                <Table.Cell>{agent.avgQuizScore.toFixed(1)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  );
}

export default TopPerformingAgents;
