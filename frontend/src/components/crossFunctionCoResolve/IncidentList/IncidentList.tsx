'use client';

import React from 'react';
import {
  Box, Card, Flex, Text,
} from '@radix-ui/themes';
import moment from 'moment';
import { List } from 'lucide-react';
import { IncidentCluster } from 'app/(admin)/cross-functional-coresolve/incidentClusters.full';

function IncidentItem({
  incident,
  onSelect,
  isSelected,
}: {
  incident: IncidentCluster;
  onSelect: (incident: IncidentCluster) => void;
  isSelected: boolean;
}) {
  // Use Created as time, Short description as title, Incident State as status, etc.
  const formattedTime = moment(incident.Created).format('hh:mm A');

  const statusColor = (status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'high':
        return 'var(--red-9)';
      case 'medium':
        return 'var(--orange-9)';
      case 'low':
        return 'var(--yellow-9)';
      default:
        return 'var(--gray-9)';
    }
  };

  return (
    <div className="relative">
      <Box m="3">
        <Card
          onClick={() => onSelect(incident)}
          onKeyDown={(e) => e.key === 'Enter' && onSelect(incident)}
          variant="ghost"
          className={isSelected ? 'bg-[var(--accent-3)] cursor-pointer' : 'cursor-pointer'}
        >
          <Flex gap="2" align="center" justify="between">
            <Flex align="center" gap="2">
              <Box position="relative">
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: isSelected ? 'var(--accent-3)' : 'var(--gray-4)',
                  }}
                >
                  <List size={20} color={isSelected ? 'var(--accent-11)' : 'var(--accent-9)'} />
                </span>
              </Box>
              <Box>
                <Text as="div" size="2" weight="bold" className={isSelected ? 'text-[var(--accent-11)] line-clamp-2' : 'line-clamp-2'}>
                  {incident["Short description"]}
                </Text>
                <Flex align="center" gap="1">
                  <Box
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: statusColor(incident["Incident State"]),
                    }}
                  />
                  <Text as="div" size="1" color="gray">
                    {(incident["Incident State"] || '').charAt(0).toUpperCase() + (incident["Incident State"] || '').slice(1)}
                  </Text>
                </Flex>
                <Text as="div" size="1" color="gray">
                  {incident["Tertiary Category"]}
                </Text>
              </Box>
            </Flex>
            <Flex direction="column" align="end">
              <Text as="div" size="1" color="gray">
                {formattedTime}
              </Text>
              <Text as="div" size="1" color="gray">
                {incident.Number}
              </Text>
            </Flex>
          </Flex>
        </Card>
      </Box>
      <div className="border-b border-gray-200 mt-2 " />
    </div>
  );
}

function IncidentList({
  incidents,
  onSelect,
  selectedItemId,
}: {
  incidents: IncidentCluster[];
  onSelect: (incident: IncidentCluster) => void;
  selectedItemId: string | undefined;
}) {
  return (
    <Flex direction="column" className="h-full border-r border-[var(--gray-8)]">
      <Box className="flex-shrink-0">
        <div className="sticky top-0 z-10 px-4 py-2 border-b border-t bg-[var(--gray-3)] border-[var(--gray-8)]">
          <Text size="4">
            Incidents
          </Text>
        </div>
      </Box>
      <Box className="overflow-auto">
        {incidents.map((incident) => (
          <IncidentItem
            key={incident.Number}
            incident={incident}
            onSelect={onSelect}
            isSelected={selectedItemId === incident.Number}
          />
        ))}
      </Box>
    </Flex>
  );
}

export default IncidentList;
