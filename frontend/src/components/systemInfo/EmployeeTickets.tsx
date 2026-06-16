import React, { useState, useEffect, useRef } from 'react';
import {
  Badge, Grid, Flex, Skeleton, Text,
} from '@radix-ui/themes';
import { Ticket } from 'types/performanceTypes';
import TicketItem from './TicketItem';
import { useTranslation } from 'react-i18next';

interface EmployeeTicketsProps {
  loading: boolean;
  tickets: Ticket[];
  employeeName: string;
}

const NO_OF_TICKETS_TO_SHOW_IN_SKELETON = 4;

// Loading skeleton for a single ticket
function TicketSkeleton() {
  const { t } = useTranslation();
  return (
    <Flex
      direction="column"
      p="3"
      gap="1"
      className="bg-[var(--accent-3)] border-l-5 border-[var(--accent-11)]"
    >
      <Flex justify="between">
        <Text size="2" weight="bold">
          <Skeleton>
            <Text size="3">{t('employee_details.loading')}</Text>
          </Skeleton>
        </Text>
        <Skeleton>
          <Badge>
            <Text size="1">{t('employee_details.loading')}</Text>
          </Badge>
        </Skeleton>
      </Flex>
      <div className="flex items-baseline">
        <Skeleton>
          <Text size="1">{t('employee_details.loading')}</Text>
        </Skeleton>
      </div>
    </Flex>
  );
}

function EmployeeTickets({
  loading,
  tickets,
  employeeName,
}: EmployeeTicketsProps) {
  const { t } = useTranslation();
  const [gridColumns, setGridColumns] = useState<number>(2);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate grid columns based on container width
  useEffect(() => {
    const updateGridColumns = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        // Switch to 1 column when container is less than 600px wide
        // Adjust this threshold as needed
        const shouldUseSingleColumn = containerWidth < 600;
        setGridColumns(shouldUseSingleColumn ? 1 : 2);
      }
    };

    // Initial calculation
    updateGridColumns();

    // Listen for resize events
    const resizeObserver = new ResizeObserver(updateGridColumns);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  if (loading) {
    return (
      <Flex direction="column" gapY="3">
        <Text size="2" weight="bold">
          {t('employee_details.employeeTickets')}
        </Text>
        <Grid columns="2" gapX="3" gapY="3" className="overflow-y-auto">
          {Array.from({ length: NO_OF_TICKETS_TO_SHOW_IN_SKELETON }).map(
            (_, index) => (
              <TicketSkeleton key={index} />
            ),
          )}
        </Grid>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gapY="3" className="flex-1 min-h-0">
      <Text size="2" weight="medium">
        {t('employee_details.employeeTickets')}
      </Text>
      <div ref={containerRef}>
        <Grid
          columns={gridColumns.toString()}
          gapX="3"
          gapY="3"
          className="overflow-y-auto"
        >
          {tickets.length === 0 ? (
            <Flex direction="column" style={{ gridColumn: '1 / -1' }}>
              <Text size="1" align="center">
                {t('employee_details.noIncidentsFound')}
              </Text>
            </Flex>
          ) : (
            tickets.map((ticket) => (
              <TicketItem
                key={ticket.taskNumber}
                ticket={ticket}
                employeeName={employeeName}
              />
            ))
          )}
        </Grid>
      </div>
    </Flex>
  );
}

export default EmployeeTickets;
