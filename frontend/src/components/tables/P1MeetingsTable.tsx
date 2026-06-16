import React, { useState, useMemo } from 'react';
import { MdPhone, MdVideoCall } from 'react-icons/md';
import { CaretSortIcon } from '@radix-ui/react-icons';
import {
  Table, Button, Flex, Badge, Text,
} from '@radix-ui/themes';
import Link from 'next/link';
import { P1Meeting } from 'types/common';
import { sortP1Data } from 'utils/sortUtils';
import { stringUtils } from 'utils/stringUtils';
import { formatMeetingDate } from 'utils/dateUtils';
import { formatMeetingTime } from 'utils/timeUtils';

interface MeetingTableProps {
  tableData: P1Meeting[];
}

function ChannelTag({ channel }: { channel: string }) {
  return (
    <Badge variant="outline" size="1">
      <Flex gap="1" align="center">
        {channel === 'Phone' ? (
          <MdPhone size={14} />
        ) : (
          <MdVideoCall size={14} />
        )}
        {channel}
      </Flex>
    </Badge>
  );
}

// StatusChip component
function StatusChip({ status }: { status: string }) {
  const formatStatus = (statusValue: string): string => {
    if (statusValue === 'transcript_processing') return 'Processing';
    return statusValue
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Badge variant="outline" size="1">
      {formatStatus(status)}
    </Badge>
  );
}

function P1MeetingTable({ tableData }: MeetingTableProps) {
  const [sortColumn, setSortColumn] = useState<keyof P1Meeting | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: keyof P1Meeting) => {
    setSortDirection((prevDirection) => (sortColumn === column && prevDirection === 'asc' ? 'desc' : 'asc'));
    setSortColumn(column);
  };

  // Memoize the sorted data to prevent unnecessary re-renders
  const sortedData = useMemo(
    () => sortP1Data(tableData, sortColumn, sortDirection),
    [tableData, sortColumn, sortDirection],
  );
  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell onClick={() => handleSort('title')}>
            <Flex align="center" gap="2">
              Incident #
              <CaretSortIcon />
            </Flex>
          </Table.ColumnHeaderCell>
          {['title', 'start_timestamp', 'analysis_status', 'channel'].map(
            (column) => (
              <Table.ColumnHeaderCell
                key={column}
                onClick={() => handleSort(column as keyof P1Meeting)}
              >
                <Flex align="center" gap="2">
                  {column.charAt(0).toUpperCase()
                    + column.slice(1).replace('_', ' ')}
                  <CaretSortIcon />
                </Flex>
              </Table.ColumnHeaderCell>
            ),
          )}
          <Table.ColumnHeaderCell className="text-right">
            Actions
          </Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {sortedData.map((meeting) => (
          <Table.Row key={meeting.meeting_id}>
            <Table.Cell>{meeting.incident_number}</Table.Cell>
            <Table.Cell>{stringUtils.trimText(meeting.title)}</Table.Cell>
            <Table.Cell>
              <Text weight="medium">
                {formatMeetingDate(meeting.start_timestamp)}
              </Text>
              {' '}
              <Text color="gray">
                {formatMeetingTime(meeting.start_timestamp)}
              </Text>
            </Table.Cell>
            <Table.Cell>
              <StatusChip status={meeting.analysis_status} />
            </Table.Cell>
            <Table.Cell>
              <ChannelTag channel={meeting.channel} />
            </Table.Cell>
            <Table.Cell className="text-right">
              <Link
                href={
                  meeting.analysis_status === 'analysis_done'
                    ? `postcall?meetingId=${meeting.meeting_id}`
                    : `copilot?meetingId=${meeting.meeting_id}`
                }
                passHref
              >
                <Button size="1" className="min-w-[60px] cursor-pointer">
                  {meeting.analysis_status === 'analysis_done'
                    ? 'Postcall'
                    : 'Co-Resolve'}
                </Button>
              </Link>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

export default P1MeetingTable;
