'use client';

import React, { useState } from 'react';
import withAuth from 'components/withAuth';
import {
  Flex, Text, Button, DropdownMenu, Separator,
} from '@radix-ui/themes';
import TokenChatIcon from 'components/icons/TokenChatIcon';
import ChatAiIcon from 'components/icons/ChatAiIcon';
import OpenTicketIcon from 'components/icons/OpenTicketIcon';
import FieldTimeIcon from 'components/icons/FieldTimeIcon';
import { MetricCard } from 'components/admin/MetricCard';
import { IconBox } from 'components/icons/IconBox';
import { TiExportOutline } from 'react-icons/ti';
import TopUsedKBs from '../TopUsedKBs';
import IssueList from '../IssueList';
import { ScatterLineGraph, ScatterLineGraphData } from '../ScatterLineGraph';
import { DonutPiechart, DonutPiechartProps } from '../DonutPiechart';
import { GroupBarGraph, GroupBarGraphProps } from '../GroupBarGraph';

const GraphData: ScatterLineGraphData = {
  xAxis: ['Sept 1', 'Sept 7', 'Sept 14', 'Sept 21', 'Sept 28'],
  lines: [
    {
      yAxis: [220, 110, 130, 80, 90],
      name: 'Resolved',
      color: '#EBAF78',
      fillColor: 'rgba(235, 175, 120, 0.2)',
    },
    {
      yAxis: [10, 15, 5, 25, 8],
      name: 'Converted to tickets',
      color: '#4064FF',
      fillColor: 'rgba(64, 100, 225, 0.2)',
    },
  ],
};

const DonutPiechartData: DonutPiechartProps = {
  section: [
    { value: 40, label: 'Server', markerColor: '#7C5CFC' },
    { value: 30, label: 'Database', markerColor: '#9E85FF' },
    { value: 15, label: 'Network', markerColor: '#BFB0FF' },
    { value: 14, label: 'Software', markerColor: '#D7CFFF' },
    { value: 1, label: 'Unallocated', markerColor: '#EEEAFF' },
  ],
  annotationValue: 5000,
  annotationText: 'Interactions',
};

const GroupBarGraphData: GroupBarGraphProps = {
  xAxis: ['John', 'Krishnakant', 'Aman', 'Yatish', 'Aarish'],
  bars: [
    { name: 'Total Interactions Handled', yAxis: [95, 80, 90, 75, 85], color: '#4A6EF5' },
    { name: 'Interactions Resolved', yAxis: [80, 70, 60, 70, 40], color: '#FFA07A' },
  ],
};

const kbArticles = [
  {
    title: 'Initiating a password reset request.',
    count: 28,
  },
  {
    title: 'Fetching updates on ticket progress.',
    count: 23,
  },
  {
    title: 'How to Request Access to Applications',
    count: 19,
  },
  {
    title:
      'Suggestions for resolving performance issues in the mysql database used in the application',
    count: 9,
  },
  {
    title: 'Server Crash on Startup',
    count: 9,
  },
];

const issues = [
  {
    title: 'Server Crash on Startup',
    list: [
      { id: 'INC001', name: 'John Doe' },
      { id: 'INC002', name: 'Jane Doe' },
      { id: 'INC003', name: 'Jim Beam' },
      { id: 'INC004', name: 'Jack Daniels' },
    ],
    remainingCount: 120,
  },
  {
    title:
      'Investigating Slow System Performance on Windows Login Loop sadasd adasdasd asdas d asdasdas',
    list: [
      { id: 'INC005', name: 'John Doe' },
      { id: 'INC006', name: 'Jane Doe' },
    ],
    remainingCount: 0,
  },
  {
    title: 'Database Connection Issues',
    list: [{ id: 'INC007', name: 'John Doe' }],
    remainingCount: 0,
  },
  {
    title:
      'Investigating Slow System Performance on Windows Login Loop sadasd adasdasd asdas d asdasdas',
    list: [
      { id: 'INC009', name: 'John Doe' },
      { id: 'INC010', name: 'Jane Doe' },
      { id: 'INC011', name: 'Jim Beam' },
      { id: 'INC012', name: 'Jack Daniels' },
    ],
    remainingCount: 450,
  },
];

function AgentAssist() {
  const [selectedTimeRange, setSelectedTimeRange] = useState<number>(30);

  return (
    <Flex direction="column" className="h-full overflow-y-auto bg-[#f4f5fc]">
      <Flex className="p-4" align="center" justify="between">
        <Text size="5" weight="medium">
          Agent Assist Dashboard
        </Text>
        <Flex direction="row" gap="5">
          <Flex direction="row" gap="4" align="center">
            <Button
              variant={selectedTimeRange === 7 ? 'soft' : 'ghost'}
              size="2"
              radius="medium"
              className="cursor-pointer"
              onClick={() => setSelectedTimeRange(7)}
            >
              7 days
            </Button>
            <Button
              variant={selectedTimeRange === 30 ? 'soft' : 'ghost'}
              size="2"
              radius="medium"
              className="cursor-pointer"
              onClick={() => setSelectedTimeRange(30)}
            >
              30 days
            </Button>
            <Button
              variant={selectedTimeRange === 90 ? 'soft' : 'ghost'}
              size="2"
              radius="medium"
              className="cursor-pointer"
              onClick={() => setSelectedTimeRange(90)}
            >
              90 days
            </Button>
          </Flex>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="cursor-pointer">
              <Button variant="surface" color="gray" size="2" radius="medium">
                <TiExportOutline size={20} />
                <Text size="2" weight="medium">
                  Export to
                </Text>
                <Separator orientation="vertical" className="h-full" />
                <DropdownMenu.TriggerIcon />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item>CSV</DropdownMenu.Item>
              <DropdownMenu.Item>Excel</DropdownMenu.Item>
              <DropdownMenu.Item>PDF</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </Flex>
      </Flex>

      <Flex className="mb-6 w-full px-4" gap="4">
        <MetricCard
          icon={(
            <IconBox className="bg-[#FFF3DE]">
              <TokenChatIcon color="#EBB922" />
            </IconBox>
          )}
          label="Total Interactions"
          value="500"
        />
        <MetricCard
          icon={(
            <IconBox className="bg-[#EDEDFB]">
              <FieldTimeIcon color="#5B5BD6" />
            </IconBox>
          )}
          label="Average Resolution Time"
          value="10mins"
        />
        <MetricCard
          icon={(
            <IconBox className="bg-[#FFEAF0]">
              <OpenTicketIcon color="#EF5A7A" />
            </IconBox>
          )}
          label="Total Tickets Created"
          value="120"
        />
        <MetricCard
          icon={(
            <IconBox className="bg-[#E4F6F7]">
              <ChatAiIcon color="#59C8C0" />
            </IconBox>
          )}
          label="Ticket Conversion"
          value="30%"
          annotation="converted"
          annotationColor="green"
        />
      </Flex>

      <Flex className="mb-6 min-h-[400px] w-full px-4" gap="4">
        <Flex direction="column" gap="2" className="flex-[2] rounded-lg bg-white p-6 min-w-[350px]">
          <Text size="4" weight="medium">
            Interactions Over Time
          </Text>
          <ScatterLineGraph graphData={GraphData} />
        </Flex>
        <Flex direction="column" gap="2" className="flex-1 rounded-lg bg-white p-6 min-w-[350px]">
          <Text size="4" weight="medium">
            Category Distribution
          </Text>
          <DonutPiechart chartData={DonutPiechartData} />
        </Flex>
      </Flex>

      <Flex className="mb-6 w-full px-4" gap="4" wrap="wrap" align="stretch">
        <Flex
          direction="column"
          gap="2"
          className="min-w-[350px] flex-1 rounded-lg bg-white p-6"
          align="stretch"
        >
          <Text size="4" weight="medium">
            Agent Performance Insights
          </Text>
          <GroupBarGraph graphData={GroupBarGraphData} />
        </Flex>
        <TopUsedKBs articles={kbArticles} className="min-w-[350px] flex-1" />
        <IssueList issues={issues} className="min-w-[350px] flex-1" />
      </Flex>
    </Flex>
  );
}

export default withAuth(AgentAssist);
