// components/EmployeeDetailsSection.tsx

import React from 'react';
import {
  Flex, Grid, Box, Text, Button,
} from '@radix-ui/themes';
import { useSafeCopilotStore } from 'store/Copilot';
import { useTranslation } from 'react-i18next';

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

// Loading skeleton component
function LoadingSkeleton() {
  const { t } = useTranslation();
  const EMPLOYEE_LABELS = [t('employee_details.name'), t('employee_details.email'), t('employee_details.phoneNo')];
  
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
  const { t } = useTranslation();
  return (
    <Flex gap="3" className='flex-col'>
      {[
        { label: t('employee_details.name'), value: details.name || '-' },
        { label: t('employee_details.email'), value: details.email || '-' },
        { label: t('employee_details.employeeId'), value: details?.ID || '-' },
        { label: t('employee_details.phoneNo'), value: details.phoneNumber || '-' },
      ].map(({ label, value }) => (
        <Flex key={label} className='gap overflow-x-hidden' wrap="wrap">
          <Text size="1" weight="regular" className='text-neutral-alpha min-w-24 flex-shrink-0'>
            {label}
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
          >
            {value}
          </Text>
        </Flex>
      ))}
    </Flex>
  );
}

function EmployeeDetailsSection({
  loading,
  employeeDetails,
}: EmployeeDetailsSectionProps) {
  const { t } = useTranslation();
  const isCopilotRoute = React.useMemo(() => window.location.pathname.includes('copilot'), []);
  const userNotFound = useSafeCopilotStore((state) => state.userNotFound, false);
  const setShowUserSearchModal = useSafeCopilotStore((state) => state.setShowUserSearchModal, () => {});

  // Memoize the content to prevent unnecessary re-renders
  const content = React.useMemo(() => {
    if (loading || !employeeDetails) {
      return <LoadingSkeleton />;
    }
    return <EmployeeInfo details={employeeDetails} />;
  }, [loading, employeeDetails]);

  const showSearchButton = isCopilotRoute && (userNotFound || (!loading && (!employeeDetails?.name || employeeDetails?.name === 'Unknown User')));

  return (
    <Flex direction="column" gap="3" >
      <Flex align="center" justify="between">
        <Text size="2" weight="medium">
          {t('employee_details.employeeDetails')}
        </Text>
        {showSearchButton && (
          <Button
            size="1"
            variant="soft"
            color="iris"
            onClick={() => setShowUserSearchModal(true)}
            className="cursor-pointer"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="14" 
              height="14" 
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
      {content}
    </Flex>
  );
}

export default React.memo(EmployeeDetailsSection);
