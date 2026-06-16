// components/DeviceDetailsSection.tsx

import React, { useState } from 'react';
import {
  Flex, Grid, Box, Text, Button,
} from '@radix-ui/themes';
import { HardwareMetricFormatted } from 'types/performanceTypes';
import { useTranslation } from 'react-i18next';

interface DeviceDetailsSectionProps {
  loading: boolean;
  hardwareMetricsFormatted: HardwareMetricFormatted[];
  className?: string;
}

// Loading skeleton component
function LoadingSkeleton() {
  const { t } = useTranslation();
  const LOADING_LABELS = [
    t('employee_details.deviceName'),
    t('employee_details.operatingSystem'),
    t('employee_details.deviceType'),
    t('employee_details.userDisplayName'),
    t('employee_details.lastSyncTime'),
    t('employee_details.freeStorageSpace'),
  ];
  
  return (
    <Grid columns="2" gap="2">
      {LOADING_LABELS.map((label) => (
        <React.Fragment key={label}>
          <Text size="1" weight="regular" color="gray">
            {label}
          </Text>
          <Box
            className="loading-skeleton"
            style={{
              height: '14px',
              width: '100%',
              backgroundColor: 'var(--accent-4)',
              borderRadius: 'var(--radius-2)',
            }}
          />
        </React.Fragment>
      ))}
    </Grid>
  );
}

// Main component
function DeviceDetailsSection({
  loading,
  hardwareMetricsFormatted,
  className,
}: DeviceDetailsSectionProps) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const ITEMS_TO_SHOW_INITIALLY = 4;

  // Memoize the content to prevent unnecessary re-renders
  const content = React.useMemo(() => {
    if (loading) {
      return <LoadingSkeleton />;
    }

    if (hardwareMetricsFormatted.length === 0) {
      return (
        <Flex justify="center" align="center">
          <Text size="1" align="center">
            {t('employee_details.noSystemInfoAvailable')}
          </Text>
        </Flex>
      );
    }

    // Show only first 4 items initially, or all if showAll is true
    const itemsToShow = showAll 
      ? hardwareMetricsFormatted 
      : hardwareMetricsFormatted.slice(0, ITEMS_TO_SHOW_INITIALLY);

    return (
      <>
        <Flex gap="3" className='flex-col'>
          {itemsToShow.map((metric) => (
            <Flex key={metric.hardwareName} className='gap-2 overflow-x-hidden' wrap="wrap">
              <Text size="1" weight="regular" className='text-neutral-alpha min-w-24 flex-shrink-0'>
                {metric.hardwareName}
              </Text>
              <Text 
            size="1" 
            weight="regular" 
            style={{ 
              overflowWrap: 'break-word', 
              wordBreak: 'break-word',
              color: "#1C2024",
              flex: 1,
              minWidth: 0
            }}
          >{metric.performanceMetric}</Text>
            </Flex>
          ))}
        </Flex>
        
        {/* Show More/Less button */}
        {hardwareMetricsFormatted.length > ITEMS_TO_SHOW_INITIALLY && (
          <Flex justify="start" mt="2">
            <Button
              variant="ghost"
              size="1"
              onClick={() => setShowAll(!showAll)}
              className="text-xs"
            >
              {showAll ? t('employee_details.showLess') : t('employee_details.seeMore')}
            </Button>
          </Flex>
        )}
      </>
    );
  }, [loading, hardwareMetricsFormatted, showAll, t]);

  return (
    <Flex direction="column" gapY="3" className={`max-h-96 ${className || ''}`}>
      <Text size="2" weight="medium">
        {t('employee_details.systemInfo')}
      </Text>
      {content}
    </Flex>
  );
}

export default React.memo(DeviceDetailsSection);
