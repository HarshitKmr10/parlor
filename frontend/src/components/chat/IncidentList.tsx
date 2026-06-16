'use client';

import React from 'react';
import {
  Box, Card, Flex, Text,
} from '@radix-ui/themes';
import moment from 'moment';
import ListIcon from 'components/image/ListIcon';
import { useTranslation } from 'react-i18next';

interface PastDeviceIncident {
  date: string;
  value: number;
  text: string;
}

interface PastAlert {
  date: string;
  value: number;
  cpuUsage: number;
  diskSpace: number;
  memoryUsage: number;
}

interface CICount {
  label: string;
  value: number;
  color: string;
}

interface CMDBDataInsight {
  label: string;
  value: number;
  color: string;
}

export interface Incident {
  id: string;
  link: string;
  type: string;
  incidentState: string;
  alertType: string;
  priority: string;
  urgency: string;
  impact: string;
  reportedBy: string;
  Location: string;
  imageType: string;
  iconType: string | null;
  title: string;
  status: string;
  summary: string;
  time: string;
  pastDeviceIncident: PastDeviceIncident[];
  pastAlerts: PastAlert[];
  ciCount: CICount[];
  cmdbDataInsight: CMDBDataInsight[];
}

function IncidentItem({
  incident,
  onSelect,
  isSelected,
  isFranchiseOwner = false,
}: {
  incident: Incident;
  onSelect: (incident: Incident) => void;
  isSelected: boolean;
  isFranchiseOwner?: boolean;
}) {
  const formattedTime = moment(incident.time, 'h:mm A').format('hh:mm A');

  const statusColor = (status: string) => {
    switch (status.toLowerCase()) {
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
                <ListIcon iconType={incident.iconType} imageType={incident.imageType} />
              </Box>
              <Box>
                <Text as="div" size="2" weight="bold" className={isSelected ? 'text-[var(--accent-11)]' : ''}>
                  {incident.title}
                </Text>
                <Flex align="center" gap="1">
                  <Box
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: statusColor(incident.status),
                    }}
                  />
                  <Text as="div" size="1" color="gray">
                    {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
                  </Text>
                </Flex>
                <Text as="div" size="1" color="gray">
                  {incident.alertType}
                </Text>
              </Box>
            </Flex>
            <Flex direction="column" align="end">
              <Text as="div" size="1" color="gray">
                {formattedTime}
              </Text>
              <Text as="div" size="1" color="gray">
                {incident.id}
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
  isFranchiseOwner = false,
  incidents,
  onSelect,
  selectedItemId,
}: {
  isFranchiseOwner?: boolean;
  incidents: Incident[];
  onSelect: (incident: Incident) => void;
  selectedItemId: string | undefined;
}) {
  const { t } = useTranslation();
  return (
    <Flex direction="column" className="h-full border-r border-[var(--gray-8)]">
      <Box className="flex-shrink-0">
        <div className="sticky top-0 z-10 px-4 py-2 border-b border-t bg-[var(--gray-3)] border-[var(--gray-8)]">
          <Text size="4">
          {isFranchiseOwner ? t('expert_copilot.tickets') : t('expert_copilot.incidents')}
          </Text>
        </div>
      </Box>
      <Box className="overflow-auto">
        {incidents.map((incident) => (
          <IncidentItem
            key={incident.id}
            incident={incident}
            onSelect={onSelect}
            isSelected={selectedItemId === incident.id}
            isFranchiseOwner={isFranchiseOwner}
          />
        ))}
      </Box>
    </Flex>
  );
}

export default IncidentList;
