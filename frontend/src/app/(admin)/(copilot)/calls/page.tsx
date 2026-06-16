'use client';

import React, { useEffect, useState } from 'react';
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { Box, Button, Dialog, Flex, Text, Select, Table } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import Shimmer from 'components/common/Shimmer/Shimmer';
import NoDataIcon from 'components/icons/no-records';
import useMeetings from 'hooks/useMeetings';
import MeetingTable from 'components/tables/MeetingTable';
import withAuth from 'components/withAuth';
import JoinForm from 'components/forms/JoinForm';
import { useGlobalContext } from 'contexts/store';
import NoOnGoingCallIcon from '@/components/icons/NoOnGoingCallIcon';

function CallLogs() {
  const { t } = useTranslation();
  const {
    meetings,
    isLoading,
    isLoadingMore,
    error,
    localError: intakeMeetingsError,
    hasMore,
    hasPrevious,
    loadNext,
    loadPrevious,
    currentPageSize,
    limit,
    changeLimit,
  } = useMeetings();
  const [localError, setLocalError] = useState(null);
  const { organization } = useGlobalContext();

  useEffect(() => {
    if (intakeMeetingsError) {
      setLocalError(intakeMeetingsError);
    }
    if (meetings && meetings?.length > 0) {
      setLocalError(null);
    }
  }, [meetings, isLoading, intakeMeetingsError]);

  const renderShimmerTable = () => (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>{t('voice_copilot.title')}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{t('voice_copilot.startTimestamp')}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{t('voice_copilot.duration')}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{t('voice_copilot.analysisStatus')}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{t('voice_copilot.channel')}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className="text-right">{t('voice_copilot.actions')}</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {Array.from({ length: limit }).map((_, index) => (
          <Table.Row key={index}>
            <Table.Cell>
              <Shimmer width="200px" height="20px" borderRadius="4px" />
            </Table.Cell>
            <Table.Cell>
              <Flex direction="column" gap="1">
                <Shimmer width="120px" height="16px" borderRadius="4px" />
              </Flex>
            </Table.Cell>
            <Table.Cell>
              <Shimmer width="80px" height="16px" borderRadius="4px" />
            </Table.Cell>
            <Table.Cell>
              <Shimmer width="100px" height="22px" borderRadius="12px" />
            </Table.Cell>
            <Table.Cell>
              <Shimmer width="80px" height="22px" borderRadius="12px" />
            </Table.Cell>
            <Table.Cell className="text-right">
              <Flex justify="end">
                <Shimmer width="80px" height="28px" borderRadius="6px" />
              </Flex>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );

  const renderContent = () => {
    if (isLoading) {
      return renderShimmerTable();
    }

    if (meetings?.length > 0) {
      return <MeetingTable tableData={meetings} />;
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <NoOnGoingCallIcon />
        <Text className="text-center text-lg font-semibold text-[#202020]">{t('voice_copilot.noOngoingCall')}</Text>
        <p className="text-center text-sm font-normal text-[#646464]">
          {t('voice_copilot.onceCallDetected')}
        </p>
      </div>
    );
  };

  const renderPaginationFooter = () => {
    if (isLoading || !meetings?.length) return null;

    return (
      <Box className="flex-shrink-0 border-t border-[var(--gray-8)]">
        <Flex align="center" justify="between" className="h-14" px="4">
          <Flex gap="3" align="center">
            <Text size="2" color="gray">
              {t('voice_copilot.showing')} {currentPageSize} {currentPageSize !== 1 ? t('voice_copilot.meetings') : t('voice_copilot.meeting')}
            </Text>

            <Flex gap="2" align="center">
              <Text size="2" color="gray">
                {t('voice_copilot.itemsPerPage')}
              </Text>
              <Select.Root
                value={limit.toString()}
                onValueChange={(value) => changeLimit(Number(value))}
                size="1"
              >
                <Select.Trigger className="cursor-pointer" />
                <Select.Content>
                  <Select.Item value="10">10</Select.Item>
                  <Select.Item value="20">20</Select.Item>
                  <Select.Item value="30">30</Select.Item>
                  <Select.Item value="40">40</Select.Item>
                  <Select.Item value="50">50</Select.Item>
                </Select.Content>
              </Select.Root>
            </Flex>
          </Flex>
          {meetings?.length > 0 && (
            <Flex gap="2" align="center">
              <Button
                size="2"
                variant="soft"
                disabled={!hasPrevious || isLoadingMore}
                onClick={loadPrevious}
                className="cursor-pointer"
              >
                <ChevronLeftIcon />
                {t('voice_copilot.previous')}
              </Button>

              <Button
                size="2"
                variant="soft"
                disabled={!hasMore || isLoadingMore}
                onClick={loadNext}
                className="cursor-pointer"
              >
                {isLoadingMore ? t('voice_copilot.loading') : t('voice_copilot.next')}
                {!isLoadingMore && <ChevronRightIcon />}
              </Button>
            </Flex>
          )}
        </Flex>
      </Box>
    );
  };

  if (error) {
    throw Error(error);
  }

  if (localError) {
    return (
      <Flex direction="column" className="h-full">
        <Dialog.Root>
          <Box className="flex-shrink-0 ">
            <Flex
              align="center"
              justify="between"
              className="h-14 border-b border-[var(--gray-8)]"
              px="4"
            >
              <Text size="4" weight="medium">
                {JSON.parse(organization?.config || '{}').Modules?.voice_copilot?.name ??
                  t('voice_copilot.voiceCoResolve')}
              </Text>
              <Dialog.Trigger>
                <Button size="1" className="cursor-pointer">
                  <PlusIcon />
                  {t('voice_copilot.newCall')}
                </Button>
              </Dialog.Trigger>
            </Flex>
          </Box>
          <div className="flex h-screen items-center justify-center">
            <div className="text-center">
              <NoDataIcon />
              <p className="text-2xl font-bold text-gray-700">{localError}</p>
            </div>
          </div>
          <Dialog.Content>
            <JoinForm />
          </Dialog.Content>
        </Dialog.Root>
      </Flex>
    );
  }

  return (
    <Flex direction="column" className="h-full">
      <Dialog.Root>
        <Box className="flex-shrink-0">
          <Flex
            align="center"
            justify="between"
            className="h-14 border-b border-[var(--gray-8)]"
            px="4"
          >
            <Text size="4" weight="medium">
              {JSON.parse(organization?.config || '{}').Modules?.voice_copilot?.name ??
                'Voice Co-Resolve'}
            </Text>
            <Dialog.Trigger>
              <Button size="1" className="cursor-pointer">
                <PlusIcon />
                New Call
              </Button>
            </Dialog.Trigger>
          </Flex>
        </Box>

        <Box className="flex-grow overflow-y-auto px-2">{renderContent()}</Box>

        {renderPaginationFooter()}

        <Dialog.Content>
          <JoinForm />
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}

export default withAuth(CallLogs);
