import React, { useState, useMemo, useEffect } from 'react';
import { MdPhone, MdVideoCall } from 'react-icons/md';
import {
  Table, Button, Flex, Badge, Text, Tooltip
} from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import TokenChatIcon from 'components/icons/TokenChatIcon';
import FieldTimeIcon from 'components/icons/FieldTimeIcon';
import OpenTicketIcon from 'components/icons/OpenTicketIcon';
import { IconBox } from 'components/icons/IconBox';
import { Meeting, UserType } from 'types/common';
import { sortData } from 'utils/sortUtils';
import { stringUtils } from 'utils/stringUtils';
import { formatMeetingDate } from 'utils/dateUtils';
import { formatMeetingTime } from 'utils/timeUtils';
import { CaretSortIcon } from '@radix-ui/react-icons';
import { Box, Skeleton } from '@radix-ui/themes';
import { useRouter } from 'next/navigation';


interface MeetingAnalytics {
  number_of_meetings: number;
  total_duration: number;
  total_number_of_kbs_created: number;
}

// Hardcoded participant data
const hardcodedParticipants = [
  { name: 'John Doe', avatar: null },
  { name: 'Jane Smith', avatar: null },
  { name: 'Bob Johnson', avatar: null },
  { name: 'Alice Brown', avatar: null },
  { name: 'Charlie Davis', avatar: null },
];

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

function StatusChip({ status }: { status: string }) {
  const { t } = useTranslation();
  const formatStatus = (statusValue: string): string => {
    if (statusValue === 'transcript_processing') return t('knowledge_assist.processing');
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

const TrimmedTitleWithTooltip = ({ title }: { title: string }) => {
  const trimmedTitle = stringUtils.trimText(title, 50);
  return trimmedTitle !== title ? (
    <Tooltip content={title}>
      <Text>{trimmedTitle}</Text>
    </Tooltip>
  ) : (
    <Text>{title}</Text>
  );
};


interface KnowledgeMeetingsTableProps {
  tableData: Meeting[];
  onCreateKB: (meetingId: string) => void;
  onGenerateQuiz: (meetingId: string) => void;
  isKbLoading: boolean;
  isQuizLoading: boolean;
  selectedMeetingId: string | null;
  analytics: MeetingAnalytics;
  isAnalyticsLoading: boolean;
}

function MetricCard({
  icon,
  title,
  value,
  isLoading,
  onClick
}: {
  icon: React.ReactNode,
  title: string,
  value: string,
  isLoading?: boolean,
  onClick?: () => void
}) {
  return (
    <Box
      className={`p-4 rounded-lg border bg-white w-[450px] ${onClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
      onClick={onClick}
    >
      <Flex gap="3" align="start">
        {icon}
        <Flex direction="column" gap="1">
          <Text size="2" color="gray">
            {title}
          </Text>
          {isLoading ? (
            <Skeleton style={{ width: '100px', height: '32px' }} />
          ) : (
            <Text size="6" weight="bold">
              {value}
            </Text>
          )}
        </Flex>
      </Flex>
    </Box>
  );
}

function KnowledgeMeetingsTable({
  tableData,
  onCreateKB,
  onGenerateQuiz,
  isKbLoading,
  isQuizLoading,
  selectedMeetingId,
  isAnalyticsLoading,
  analytics,
}: KnowledgeMeetingsTableProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [sortColumn, setSortColumn] = useState<keyof Meeting | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');


  const handleSort = (column: keyof Meeting) => {
    setSortDirection((prevDirection) => (sortColumn === column && prevDirection === 'asc' ? 'desc' : 'asc'));
    setSortColumn(column);
  };

  const sortedData = useMemo(
    () => sortData(tableData, sortColumn, sortDirection),
    [tableData, sortColumn, sortDirection],
  );

  // Format duration helper function
  const formatDuration = (minutes: number) => {
    const roundedMinutes = Math.round(minutes);
    const hours = Math.floor(roundedMinutes / 60);
    const remainingMinutes = roundedMinutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  };

  const handleKBsClick = () => {
    router.push('/knowledge/kbs');
  };

  return (
    <Flex direction="column" gap="6" className="mt-2">
      <Flex justify="start" gap="4">
        <MetricCard
          icon={
            <IconBox className="bg-[#FFF3DE]">
              <TokenChatIcon color="#EBB922" />
            </IconBox>
          }
          title={t('knowledge_assist.totalNumberOfMeetings')}
          value={analytics.number_of_meetings.toString()}
          isLoading={isAnalyticsLoading}
        />
        <MetricCard
          icon={
            <IconBox className="bg-[#FFEAF0]">
              <OpenTicketIcon color="#EF5A7A" />
            </IconBox>
          }
          title={t('knowledge_assist.numberOfDocumentsCreated')}
          value={analytics.total_number_of_kbs_created.toString()}
          isLoading={isAnalyticsLoading}
          onClick={handleKBsClick}
        />
      </Flex>

      {/* Existing Table */}
      <Table.Root>
        <Table.Header>
          <Table.Row>
            {[
              { key: 'title', label: t('knowledge_assist.title') },
              { key: 'start_timestamp', label: t('knowledge_assist.startTimestamp') },
              { key: 'analysis_status', label: t('knowledge_assist.analysisStatus') },
            ].map((column) => (
              <Table.ColumnHeaderCell
                key={column.key}
                onClick={() => handleSort(column.key as keyof Meeting)}
                className="text-left"
              >
                <Flex align="center" gap="5">
                  {column.label}
                  <CaretSortIcon />
                </Flex>
              </Table.ColumnHeaderCell>
            ))}
            <Table.ColumnHeaderCell className="text-left">
              {t('knowledge_assist.actions')}
            </Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {sortedData.map((meeting) => (
            <Table.Row key={meeting.meeting_id}>
              <Table.Cell className="text-left cursor-pointer ">
                <Tooltip content={meeting.title}>
                  <Text className="line-clamp-1 w-max max-w-[400px]">
                    {meeting.title}
                  </Text>
                </Tooltip>
              </Table.Cell>
              <Table.Cell className="text-left">
                <Text weight="medium">
                  {formatMeetingDate(meeting.start_timestamp)}
                </Text>
                {' '}
                <Text color="gray">
                  {formatMeetingTime(meeting.start_timestamp)}
                </Text>
              </Table.Cell>
              {/*  <Table.Cell className="text-left">
                <Flex align="center" gap="1">
                  <div className="flex -space-x-2">
                    {/* Hardcoded participants for demonstration
                    {hardcodedParticipants
                      .slice(0, 4)
                      .map((participant, index) => (
                        <CustomAvatar
                          key={index}
                          alt={participant.name}
                          src={participant.avatar}
                          name={participant.name}
                          height="32px"
                          width="32px"
                          extra="border-2 border-white"
                        />
                      ))}
                    {hardcodedParticipants.length > 4 && (
                      <div className="w-8 h-8 rounded-md bg-gray-100 border-2 border-white flex items-center justify-center text-xs">
                        +
                        {hardcodedParticipants.length - 4}
                      </div>
                    )}
                  </div>
                </Flex>
              </Table.Cell> 
              <Table.Cell className="text-left">
                <ChannelTag channel={meeting.channel} />
              </Table.Cell>*/}
              {/* <Table.Cell className="text-left">
                <Text>
                  {sortedData.indexOf(meeting) === 0
                    ? 'Planning'
                    : sortedData.indexOf(meeting) === 1
                      ? 'SME Training'
                      : sortedData.indexOf(meeting) === 2
                        ? 'Process Training'
                        : sortedData.indexOf(meeting) === 3
                          ? 'KB Training'
                          : 'Acquisition Meeting'}
                </Text>
              </Table.Cell>  */}
              <Table.Cell className="text-left">
                <StatusChip status={meeting.analysis_status} />
              </Table.Cell>
              <Table.Cell className="text-left">
                <Link
                  href={
                    meeting.analysis_status === 'analysis_done'
                      ? `postcall?meetingId=${meeting.meeting_id}`
                      : `copilot?meetingId=${meeting.meeting_id}`
                  }
                  passHref
                >
                  <Button
                    size="1"
                    className="mr-2 cursor-pointer"
                    variant="solid"
                  >
                    {meeting.analysis_status === 'analysis_done'
                      ? t('knowledge_assist.knowledgeReport')
                      : t('knowledge_assist.coResolve')}
                  </Button>
                </Link>
                {meeting.analysis_status === 'analysis_done' && (
                  <Link
                    href={`postcall?meetingId=${meeting.meeting_id}&tab=createKB`}
                    passHref
                  >
                    <Button
                      className="mr-2 cursor-pointer"
                      variant="solid"
                      size="1"
                    >
                      {t('knowledge_assist.createDocument')}
                    </Button>
                  </Link>
                )}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Flex>
  );
}

export default KnowledgeMeetingsTable;
