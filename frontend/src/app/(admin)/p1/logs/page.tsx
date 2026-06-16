'use client';

import React from 'react';
import { Box, Flex, Text } from '@radix-ui/themes';
import Spinner from 'components/spinner/spinner';
import NoDataIcon from 'components/icons/no-records';
import useP1Meetings from 'hooks/useP1Meetings';
import withAuth from 'components/withAuth';
import P1MeetingTable from 'components/tables/P1MeetingsTable';
import { useGlobalContext } from 'contexts/store';

function P1Logs() {
  const { p1Meetings, isLoading, error } = useP1Meetings();
  const { organization } = useGlobalContext();

  const renderContent = () => {
    if (isLoading) {
      return <Spinner />;
    }

    if (p1Meetings?.length > 0) {
      return <P1MeetingTable tableData={p1Meetings} />;
    }

    return (
      <div className="text-2xl font-bold text-gray-700">
        No P1 meetings found
      </div>
    );
  };

  if (error) {
    return (
      <Flex direction="column" className="h-full">
        <Box className="flex-shrink-0">
          <Flex
            align="center"
            justify="between"
            className="h-14 border-b border-[var(--gray-8)]"
            px="4"
          >
            <Text size="4" weight="medium">
              {JSON.parse(organization.config).Modules.voice_p1_bridge.name
                ?? 'P1 Co-Resolve'}
            </Text>
          </Flex>
        </Box>
        <div className="flex justify-center items-center h-screen">
          <div className="text-center">
            <NoDataIcon />
            <p className="text-2xl font-bold text-gray-700">{error}</p>
          </div>
        </div>
      </Flex>
    );
  }

  return (
    <Flex direction="column" className="h-full">
      <Box className="flex-shrink-0">
        <Flex
          align="center"
          justify="between"
          className="h-14 border-b border-[var(--gray-8)]"
          px="4"
        >
          <Text size="4" weight="medium">
            {JSON.parse(organization?.config || '{}').Modules?.voice_p1_bridge
              ?.name ?? 'P1 Co-Resolve'}
          </Text>
        </Flex>
      </Box>
      <Box className="px-2 overflow-y-auto">{renderContent()}</Box>
    </Flex>
  );
}

export default withAuth(P1Logs);
