'use client';

import { Box, Text, Flex } from '@radix-ui/themes';
import ChatSection from '@/components/crossFunctionCoResolve/ChatSection/ChatSection';
import withAuth from 'components/withAuth';
import React, { useState } from 'react';
import { incidentClusters, IncidentCluster } from './incidentClusters.full';
import IncidentList from '@/components/crossFunctionCoResolve/IncidentList';
import Details from '@/components/crossFunctionCoResolve/Details';

function ExpertCopilot() {
  const [selectedItem, setSelectedItem] = useState<IncidentCluster | null>(
    incidentClusters[0],
  );
  const [answers, setAnswers] = useState<[string, any][]>([]);

  const handleIncidentSelect = (incident: IncidentCluster) => {
    setSelectedItem(incident);
  };
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
            Cross Functional CoResolve
          </Text>
        </Flex>
      </Box>
      <Flex className="flex-grow overflow-hidden">
        <Flex
          direction="column"
          className="w-1/4 border-r border-[var(--gray-8)]"
        >
          <Box className="h-full overflow-hidden">
            <IncidentList
              incidents={incidentClusters}
              onSelect={handleIncidentSelect}
              selectedItemId={selectedItem?.Number}
            />
          </Box>
        </Flex>
        <Box className="w-1/2">
          <ChatSection
            selectedItem={selectedItem}
            answers={answers}
            setAnswers={setAnswers}
          />
        </Box>
        <Box className="w-1/4 overflow-auto">
          <Details selectedItem={selectedItem} />
        </Box>
      </Flex>
    </Flex>
  );
}

export default ExpertCopilot;
