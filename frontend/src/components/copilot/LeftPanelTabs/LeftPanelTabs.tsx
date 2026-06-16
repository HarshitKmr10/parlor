import React, { Suspense, useRef } from 'react';
import { Box, Tabs, Flex, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useOrganizationConfig } from 'hooks/useOrganizationConfig';
import Spinner from 'components/spinner/spinner';
import CallerInfoTab from './CallerInfoTab';

const EmployeeDetailsTab = React.lazy(() => import('../EmployeeDetails'));

interface CallerInfoTabsProps {
  extra?: string;
}

function CallerInfoTabs({ extra }: CallerInfoTabsProps) {
  const { t } = useTranslation();
  // Get organization config
  const { config } = useOrganizationConfig();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Default to employeeDetails if ticketing is enabled, otherwise transcript
  const defaultTab = config?.ticketingEnabled ? 'employeeDetails' : 'transcript';

  return (
    <Flex direction="column" className={`h-full ${extra}`}>
      <Tabs.Root defaultValue={defaultTab} className="flex h-full flex-col">
        <Box className="flex-shrink-0">
          <Tabs.List>
            {config?.ticketingEnabled && (
              <Tabs.Trigger className='cursor-pointer' value="employeeDetails">
                <Text weight="medium" className="text-clamp-sm">{t('voice_copilot.employeeDetails')}</Text>
              </Tabs.Trigger>
            )}
            <Tabs.Trigger className='cursor-pointer' value="transcript">
              <Text weight="medium" className="text-clamp-sm">{t('voice_copilot.realtimeTranscript')}</Text>
            </Tabs.Trigger>
          </Tabs.List>
        </Box>

        <Tabs.Content
          value="transcript"
          className="flex-grow overflow-y-auto"
          ref={scrollContainerRef}
        >
          <CallerInfoTab containerRef={scrollContainerRef} />
        </Tabs.Content>

        {config?.ticketingEnabled && (
          <Suspense fallback={<Spinner />}>
            <EmployeeDetailsTab />
          </Suspense>
        )}
      </Tabs.Root>
    </Flex>
  );
}

CallerInfoTabs.defaultProps = {
  extra: '',
};

export default CallerInfoTabs;
