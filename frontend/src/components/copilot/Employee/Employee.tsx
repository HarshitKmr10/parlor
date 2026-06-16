// components/EmployeeDetailsSection.tsx

import React from 'react';
import {
  Flex, Grid, Box, Text,
} from '@radix-ui/themes';

interface EmployeeDetails {
  ID: string;
  name: string;
  phoneNumber: string;
  email: string;
}

interface EmployeeDetailsSectionProps {
  loading: boolean;
  employeeDetails: EmployeeDetails | null;
}

// Array of labels for both loading skeleton and employee details
const EMPLOYEE_LABELS = ['Name', 'Email', 'Phone No'];

// Loading skeleton component
function LoadingSkeleton() {
  return (
    <Grid columns="2" gap="2">
      {EMPLOYEE_LABELS.map((label) => (
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

// Employee details component
function EmployeeInfo({ details }: { details: EmployeeDetails }) {
  return (
    <Grid columns="2" gap="2">
      {[
        { label: 'Name', value: details.name },
        { label: 'Email', value: details.email },
        // { label: 'Employee Id', value: details.ID },
        { label: 'Phone No', value: details.phoneNumber },
      ].map(({ label, value }) => (
        <React.Fragment key={label}>
          <Text size="1" weight="regular" color="gray">
            {label}
          </Text>
          <Text size="1" style={{ overflowWrap: 'break-word' }}>
            {value}
          </Text>
        </React.Fragment>
      ))}
    </Grid>
  );
}

function EmployeeDetailsSection({
  loading,
  employeeDetails,
}: EmployeeDetailsSectionProps) {
  // Memoize the content to prevent unnecessary re-renders
  const content = React.useMemo(() => {
    if (loading || !employeeDetails) {
      return <LoadingSkeleton />;
    }
    return <EmployeeInfo details={employeeDetails} />;
  }, [loading, employeeDetails]);

  return (
    <Flex direction="column" gap="3">
      <Text size="2" weight="bold">
        Employee Details
      </Text>
      {content}
    </Flex>
  );
}

export default React.memo(EmployeeDetailsSection);
