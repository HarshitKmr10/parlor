import React from 'react';
import { Tabs } from '@radix-ui/themes';
import EmployeeDetails from 'components/systemInfo/EmployeeDetails';
import { Ticket } from 'types/performanceTypes';

interface EmployeeDetailsTabProps {
  isDeviceDetailsLoading: boolean;
  isUserDetailsLoading: boolean;
  hasEmployeeId: boolean;
  employeeId: string;
  employeeName: string;
  phoneNumber: string;
  endpointManagementEnabled: boolean;
  email: string;
  hardwareMetrics: any;
  tickets: Ticket[];
  isTicketLoading: boolean;
  useUserId: boolean;
}

function EmployeeDetailsTab({
  isDeviceDetailsLoading,
  isUserDetailsLoading,
  hasEmployeeId,
  employeeId,
  employeeName,
  phoneNumber,
  endpointManagementEnabled,
  email,
  hardwareMetrics,
  tickets,
  isTicketLoading,
  useUserId,
}: EmployeeDetailsTabProps) {
  return (
    <Tabs.Content value="employeeDetails" className="overflow-y-hidden h-full">
      <EmployeeDetails
        isDeviceDetailsLoading={isDeviceDetailsLoading}
        isUserDetailsLoading={isUserDetailsLoading}
        hasEmployeeId={hasEmployeeId}
        employeeId={employeeId}
        employeeName={employeeName}
        phoneNumber={phoneNumber}
        endpointManagementEnabled={endpointManagementEnabled}
        email={email}
        hardwareMetrics={hardwareMetrics}
        tickets={tickets}
        isTicketLoading={isTicketLoading}
        useUserId={useUserId}
      />
    </Tabs.Content>
  );
}

export default EmployeeDetailsTab;
