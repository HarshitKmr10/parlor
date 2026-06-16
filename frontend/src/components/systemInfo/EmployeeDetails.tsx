// components/EmployeeDetails.tsx

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Box, Flex, Text, Grid, Button } from '@radix-ui/themes';
import NoDataIcon from 'components/icons/NoDataIcon';
import { EmployeeDetailsProps, HardwareMetricFormatted } from 'types/performanceTypes';
import DeviceDetailsSection from './DeviceDetailsSection';
import EmployeeDetailsSection from './EmployeeDetailsSection';
import EmployeeTickets from './EmployeeTickets';
import { leftPanelStyles } from '../copilot/LeftPanel/LeftPanel.styles';
import { useSafeCopilotStore } from 'store/Copilot';
import { useTranslation } from 'react-i18next';

const formatHardwareName = (name: string): string =>
  name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

function NoEmployeeIdMessage({ useUserId }: { useUserId: boolean }) {
  const { t } = useTranslation();
  const isCopilotRoute = React.useMemo(() => window.location.pathname.includes('copilot'), []);
  const userNotFound = useSafeCopilotStore((state) => state.userNotFound, false);
  const setShowUserSearchModal = useSafeCopilotStore((state) => state.setShowUserSearchModal, () => {});

  return (
    <Box className="h-full px-2">
      <Flex direction="column" gapY="2" height="100%" justify="center" align="center">
        <NoDataIcon />
        <Text size="1" align="center" className="text-balance text-gray-700">
          {useUserId
            ? t('employee_details.pleaseEnterUserId')
            : t('employee_details.pleaseEnterEmployeeId')}
        </Text>
        {isCopilotRoute && userNotFound && (
          <Button
            size="2"
            variant="soft"
            color="iris"
            onClick={() => setShowUserSearchModal(true)}
            className="cursor-pointer"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            {t('employee_details.searchUser')}
          </Button>
        )}
      </Flex>
    </Box>
  );
}

function EmployeeDetails({
  hasEmployeeId,
  employeeId = '---',
  employeeName = '---',
  phoneNumber = '---',
  email = '---',
  hardwareMetrics,
  isDeviceDetailsLoading,
  isUserDetailsLoading,
  endpointManagementEnabled,
  tickets,
  isTicketLoading,
  useUserId,
}: EmployeeDetailsProps) {
  

  const employeeDetails = useMemo(() => ({
    ID: employeeId,
    name: employeeName,
    phoneNumber,
    email,
  }), [employeeId, employeeName, phoneNumber, email]);

  const isLoading = isUserDetailsLoading || (endpointManagementEnabled && isDeviceDetailsLoading);

  const hardwareMetricsFormatted: HardwareMetricFormatted[] = useMemo(() => {

    
    // Always show dummy data for UI testing when hasEmployeeId is true
    // Real data would be used when hardwareMetrics has actual values
    if (hasEmployeeId) {
      if (hardwareMetrics && Object.keys(hardwareMetrics).length > 0) {
        return Object.entries(hardwareMetrics).map(([key, value]) => ({
          hardwareName: formatHardwareName(key),
          performanceMetric: value,
        }));
      } 
    }
    return [];
  }, [hasEmployeeId, hardwareMetrics]);

  // Dummy ticket data for UI testing - memoized to prevent recreation

  // Dynamic grid columns for the main grid (Employee Details + System Info)
  const [mainGridColumns, setMainGridColumns] = useState<number>(1);
  const mainGridRef = useRef<HTMLDivElement>(null);

  // Calculate main grid columns based on container width
  useEffect(() => {
    const updateMainGridColumns = () => {
      if (mainGridRef.current) {
        const containerWidth = mainGridRef.current.offsetWidth;
        // Show 2 columns only if:
        // 1. Container is wide enough (>= 800px)
        // 2. Endpoint management is enabled
        // 3. There are hardware metrics to display
        const shouldUseTwoColumns = 
          containerWidth >= 500 && 
          !!endpointManagementEnabled && 
          hardwareMetricsFormatted?.length > 0;
        
        setMainGridColumns(shouldUseTwoColumns ? 2 : 1);
      }
    };

    // Initial calculation
    updateMainGridColumns();

    // Listen for resize events
    const resizeObserver = new ResizeObserver(updateMainGridColumns);
    if (mainGridRef.current) {
      resizeObserver.observe(mainGridRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [endpointManagementEnabled, hardwareMetricsFormatted?.length]);

  if (!hasEmployeeId) {
    return <NoEmployeeIdMessage useUserId={useUserId} />;
  }

  return (
    <div 
      className={leftPanelStyles.scrollableContent}
      style={leftPanelStyles.hiddenScrollbar}
    >
      <div
        style={leftPanelStyles.hiddenScrollbar}
        className={leftPanelStyles.webkitScrollbarHidden}
      >
        <Flex direction="column" p="3" gap="5">
      <div ref={mainGridRef}>
        <Grid
          columns={mainGridColumns.toString()}
          gap="3"
          width="auto"
        >
          <EmployeeDetailsSection loading={isLoading} employeeDetails={employeeDetails} />
          {!!endpointManagementEnabled && hardwareMetricsFormatted?.length > 0 && (
            <DeviceDetailsSection
              loading={isLoading}
              hardwareMetricsFormatted={hardwareMetricsFormatted}
              className={mainGridColumns === 1 ? "mt-4" : ""}
            />
          )}
        </Grid>
      </div>
      <Box className='mb-28'>
      <EmployeeTickets 
        loading={isTicketLoading} 
        tickets={tickets && tickets.length > 0 ? tickets : []} 
        employeeName={employeeName} 
        />
      </Box>
        </Flex>
      </div>
    </div>
  );
}

export default EmployeeDetails;
