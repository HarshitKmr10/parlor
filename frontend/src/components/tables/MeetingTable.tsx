// components/MeetingTable.tsx

import React, { useState, useMemo } from 'react';
import { MdPhone, MdVideoCall } from 'react-icons/md';
import { CaretSortIcon } from '@radix-ui/react-icons';
import { useTranslation } from 'react-i18next';
import {
  Table, Button, Flex, Badge, Text,
} from '@radix-ui/themes';
import Link from 'next/link';
import { Meeting } from 'types/common';
import { sortData } from 'utils/sortUtils';
import { stringUtils } from 'utils/stringUtils';
import { formatMeetingDate } from 'utils/dateUtils';
import { formatMeetingTime } from 'utils/timeUtils';

function formatDuration(startTimestamp?: string, endTimestamp?: string | null): string {
  if (!startTimestamp || !endTimestamp) return '-';
  
  const start = new Date(startTimestamp).getTime();
  const end = new Date(endTimestamp).getTime();
  const durationMs = end - start;
  
  if (durationMs < 0) return '-';
  
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

// ChannelTag component
function ChannelTag({ channel }: { channel: string }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" size="1">
      <Flex gap="1" align="center">
        {channel === 'Phone' || channel === t('voice_copilot.phone') ? (
          <MdPhone size={14} />
        ) : (
          <MdVideoCall size={14} />
        )}
        {channel === 'Phone' ? t('voice_copilot.phone') : channel}
      </Flex>
    </Badge>
  );
}

// StatusChip component
function StatusChip({ status }: { status: string }) {
  const { t } = useTranslation();
  const formatStatus = (statusValue: string): string => {
    if (statusValue === 'transcript_processing') return t('voice_copilot.processing');
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

interface MeetingTableProps {
  tableData: Meeting[];
}

function MeetingTable({ tableData }: MeetingTableProps) {
  const { t } = useTranslation();
  const [sortColumn, setSortColumn] = useState<keyof Meeting | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: keyof Meeting) => {
    const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortDirection(newDirection);
    setSortColumn(column);
  };

  // Memoize the sorted data to prevent unnecessary re-renders
  const sortedData = useMemo(() => {
    const sorted = sortData(tableData, sortColumn, sortDirection);
    
    // Check for duplicate meeting_ids
    const meetingIds = sorted.map(m => m.meeting_id);
    const uniqueIds = new Set(meetingIds);
    
    if (uniqueIds.size !== meetingIds.length) {
      console.warn('⚠️ DUPLICATE MEETING IDs DETECTED!');
    }
    
    return sorted;
  }, [tableData, sortColumn, sortDirection]);

  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell
            onClick={() => handleSort('title')}
          >
            <Flex align="center" gap="2">
              {t('voice_copilot.title')}
              <CaretSortIcon />
            </Flex>
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell
            onClick={() => handleSort('start_timestamp')}
          >
            <Flex align="center" gap="2">
              {t('voice_copilot.startTimestamp')}
              <CaretSortIcon />
            </Flex>
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>
            {t('voice_copilot.duration')}
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell
            onClick={() => handleSort('analysis_status')}
          >
            <Flex align="center" gap="2">
              {t('voice_copilot.analysisStatus')}
              <CaretSortIcon />
            </Flex>
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell
            onClick={() => handleSort('channel')}
          >
            <Flex align="center" gap="2">
              {t('voice_copilot.channel')}
              <CaretSortIcon />
            </Flex>
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className="text-right">
            {t('voice_copilot.actions')}
          </Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {sortedData.map((meeting, index) => (
          <Table.Row key={`${meeting.meeting_id}-${meeting.id}-${index}`}>
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
              <Text size="2">
                {formatDuration(meeting.start_timestamp, meeting.end_timestamp)}
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
                    ? t('voice_copilot.postcall')
                    : t('voice_copilot.coResolve')}
                </Button>
              </Link>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

export default MeetingTable;
