// components/systemInfo/TicketItem.tsx
import React from 'react';
import {
  Badge, Flex, Link, Text,
} from '@radix-ui/themes';
import { formatDate } from 'utils/dateUtils';
import { Ticket } from 'types/performanceTypes';
import { useTranslation } from 'react-i18next';

interface TicketItemProps {
  ticket: Ticket;
  employeeName: string;
}

function TicketItem({ ticket, employeeName }: TicketItemProps) {
  const { t } = useTranslation();
  return (
    <a
      href={ticket.ticketLink}
      className="cursor-pointer block"
      target="_blank"
      rel="noopener noreferrer"
    >
      <Flex
        direction="column"
        p="2"
        className="cursor-pointer first:mt-0 bg-[var(--accent-3)] border-l-5 border-[var(--accent-11)] hover:bg-[var(--accent-2)]"
      >
        <Flex justify="between" className='h-5 overflow-hidden'>
          <Text size="1" weight="bold" className='text-neutral-l2 truncate'>
            {ticket.taskTitle}
          </Text>

        </Flex>
        <div className="flex items-baseline gap-1 h-5">
          <Link
            href={ticket.ticketLink}
            className="cursor-pointer text-neutral-alpha"
            weight={"regular"}
            size="1"
            target="_blank"
            rel="noopener noreferrer"
          >
            #
            {ticket.taskNumber}
          </Link>
          <Text size="1" weight={"regular"} className="text-neutral-alpha">|</Text>
          <Text size="1" weight={"regular"} className="text-neutral-alpha">
            {formatDate(ticket.createdOn)}
          </Text>
        </div>
        <Flex align={"center"} gap="1">
        <Text size="1" weight={"bold"} className="text-neutral-alpha">{t('employee_details.status')}</Text>
        <Text size="1" weight={"medium"} className="text-neutral-alpha">{ticket.taskStatus}</Text>
        </Flex>
        
      </Flex>
    </a>
  );
}

export default TicketItem;
