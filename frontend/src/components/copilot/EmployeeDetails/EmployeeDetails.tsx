import React, { useMemo } from 'react';
import { Tabs } from '@radix-ui/themes';
import EmployeeDetails from 'components/systemInfo/EmployeeDetails';
import { useCopilotStore } from 'store/Copilot';
import { useTicketsStore } from 'store/Tickets/TicketsStore';
import { useDevicesStore } from 'store/Devices/DevicesStore';
import { useOrganizationConfig } from 'hooks/useOrganizationConfig';

/**
 * EmployeeDetailsTab Component
 * 
 * Displays employee details including:
 * - User information (name, phone, email)
 * - Device/hardware metrics (if endpoint management is enabled)
 * - Associated tickets (from TicketsStore)
 * 
 * Fetches all data from Zustand stores - no props required.
 */
function EmployeeDetailsTab() {
  // ==================== Store Data ====================
  const userDetails = useCopilotStore((state) => state?.userDetails);
  const isUserLoading = useCopilotStore((state) => state?.isUserLoading);

  // Devices from DevicesStore
  const deviceDetails = useDevicesStore((state) => state.deviceDetails);
  const loadingDeviceDetails = useDevicesStore((state) => state.loadingDeviceDetails);

  // Tickets from TicketsStore
  const tickets = useTicketsStore((state) => state.tickets);
  const loadingTickets = useTicketsStore((state) => state.loadingTickets);

  // ==================== Configuration ====================
  const { config } = useOrganizationConfig();

  // ==================== Transform Device Data ====================
  const hardwareMetrics = useMemo(() => {
    if (!deviceDetails || !Array.isArray(deviceDetails) || deviceDetails.length === 0) {
      return {};
    }

    const device = deviceDetails[0];
    
    if (!device || typeof device !== 'object') {
      return {};
    }

    // Transform device object into simple key-value pairs for display
    const metrics: Record<string, number | string> = {};

    if (device.deviceName) metrics.deviceName = String(device.deviceName);
    if (device.operatingSystem) metrics.operatingSystem = String(device.operatingSystem);
    if (device.osVersion) metrics.osVersion = String(device.osVersion);
    if (device.complianceState) metrics.complianceState = String(device.complianceState);
    if (device.managementState) metrics.managementState = String(device.managementState);
    if (device.model) metrics.model = String(device.model);
    if (device.manufacturer) metrics.manufacturer = String(device.manufacturer);
    
    // Storage metrics
    if (device.totalStorageSpaceInBytes && device.freeStorageSpaceInBytes) {
      const totalGB = (device.totalStorageSpaceInBytes / (1024**3)).toFixed(2);
      const freeGB = (device.freeStorageSpaceInBytes / (1024**3)).toFixed(2);
      metrics.storage = `${freeGB} GB free of ${totalGB} GB`;
    }
    
    if (device.lastSyncDateTime && device.lastSyncDateTime !== '0001-01-01T00:00:00Z') {
      metrics.lastSync = new Date(device.lastSyncDateTime).toLocaleString();
    }

    return metrics;
  }, [deviceDetails]);

  // ==================== Render ====================
  return (
    <Tabs.Content value="employeeDetails" className="overflow-y-hidden h-full">
      <EmployeeDetails
        isDeviceDetailsLoading={loadingDeviceDetails}
        isUserDetailsLoading={isUserLoading}
        hasEmployeeId={!!userDetails?.employeeId}
        employeeId={userDetails?.employeeNumber || userDetails?.employeeId || ''}
        employeeName={userDetails?.fullName || ''}
        phoneNumber={userDetails?.mobilePhone || ''}
        endpointManagementEnabled={config?.endpointManagement || false}
        email={userDetails?.email || ''}
        hardwareMetrics={hardwareMetrics}
        tickets={tickets}
        isTicketLoading={loadingTickets}
        useUserId={config?.useUserId ?? false}
      />
    </Tabs.Content>
  );
}

export default EmployeeDetailsTab;
