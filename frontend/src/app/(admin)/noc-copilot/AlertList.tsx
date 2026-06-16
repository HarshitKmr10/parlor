'use client';

import React from 'react';
import {
  Box, Card, Flex, Text,
} from '@radix-ui/themes';
import moment from 'moment';
import ListIcon from 'components/image/ListIcon';

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

export interface Alert {
  id: string;
  type: string;
  alertState: string;
  alertType: string;
  priority: string;
  criticality: string;
  reportedBy: string;
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

function AlertItem({
  alert,
  onSelect,
  isSelected,
}: {
  alert: Alert;
  onSelect: (alert: Alert) => void;
  isSelected: boolean;
}) {
  const formattedTime = moment(alert.time, 'h:mm A').format('hh:mm A');

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
          onClick={() => onSelect(alert)}
          onKeyDown={(e) => e.key === 'Enter' && onSelect(alert)}
          variant="ghost"
          className={
            isSelected
              ? 'bg-[var(--accent-3)] cursor-pointer'
              : 'cursor-pointer'
          }
        >
          <Flex gap="2" align="center" justify="between">
            <Flex align="center" gap="2">
              <Box position="relative">
                <ListIcon
                  iconType={alert.iconType}
                  imageType={alert.imageType}
                />
              </Box>
              <Box>
                <Text as="div" size="2" weight="bold" className={isSelected ? 'text-[var(--accent-11)]' : ''}>
                  {alert.title}
                </Text>
                <Flex align="center" gap="1">
                  <Box
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: statusColor(alert.status),
                    }}
                  />
                  <Text as="div" size="1" color="gray">
                    {alert.status.charAt(0).toUpperCase()
                      + alert.status.slice(1)}
                  </Text>
                </Flex>
                <Text as="div" size="1" color="gray">
                  {alert.alertType}
                </Text>
              </Box>
            </Flex>
            <Text as="div" size="1" color="gray">
              {formattedTime}
            </Text>
          </Flex>
        </Card>
      </Box>
      <div className="border-b border-gray-200 mt-2 " />
    </div>
  );
}

function AlertList({
  alerts,
  onSelect,
  selectedItemId,
}: {
  alerts: Alert[];
  onSelect: (alert: Alert) => void;
  selectedItemId: string | undefined;
}) {
  return (
    <Flex direction="column" className="h-full border-r border-[var(--gray-8)]">
      <Box className="flex-shrink-0">
        <div className="sticky top-0 z-10 px-4 py-2 border-b border-t bg-[var(--gray-3)] border-[var(--gray-8)]">
          <Text size="4">Alerts</Text>
        </div>
      </Box>
      <Box className="overflow-auto">
        {alerts.map((alert) => (
          <AlertItem
            key={alert.id}
            alert={alert}
            onSelect={onSelect}
            isSelected={selectedItemId === alert.id}
          />
        ))}
      </Box>
    </Flex>
  );
}

export default AlertList;
