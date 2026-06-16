'use client';

import { Card, Flex, Text, Box } from '@radix-ui/themes';
import { SimilarTicket } from './SimilarTickets';
import Link from 'next/link';
import { format } from 'date-fns';

export const getBackgroundColor = (source_table: string) => {
  switch (source_table) {
    case 'servicenow_incidents':
      return 'bg-[#F0F1FE]'; // light blue
    case 'servicenow_change_requests':
      return 'bg-[#FFFAB8]'; // light yellow
    case 'servicenow_request_items':
      return 'bg-[#FEE9F5]'; // light pink
    default:
      return 'bg-white';
  }
};

export const getSideBarColor = (source_table: string) => {
  switch (source_table) {
    case 'servicenow_incidents':
      return 'bg-[#5753C6]'; // purple
    case 'servicenow_change_requests':
      return 'bg-[#9E6C00]'; // brown
    case 'servicenow_request_items':
      return 'bg-[#C2298A]'; // pink
    default:
      return 'bg-gray-400';
  }
};

interface Props {
  ticket: SimilarTicket;
  onClick?: () => void;
  time: string; // e.g., '9:30PM'
}

const TicketCard = ({ ticket, onClick, time }: Props) => {
  const bgColor = getBackgroundColor(ticket.source_table);
  const sideBarColor = getSideBarColor(ticket.source_table);

  const formattedDate = ticket?.created_on
  ? format(new Date(ticket.created_on), 'h:mmaaa dd/MM/yyyy').replace('AM', 'AM ').replace('PM', 'PM ')
  : '';

  return (
    <Link
      href={ticket.link}
      target="_blank"
      key={ticket.id}
      onClick={onClick}
      className={`relative flex cursor-pointer border-none pt-2 pl-6 pr-3 pb-3 transition-shadow hover:shadow-md ${bgColor}`}
    >
      <div className={`absolute left-0 top-0 h-full w-1  ${sideBarColor}`} />

      {/* Top row: Subject and Time */}
      <Box className="relative">
        {/* Colored vertical bar on the left */}
        <Box>
          <Text size="1" className="text-neutral-alpha mb-2 truncate font-normal">
            #{ticket?.ticket_id} | {formattedDate}
          </Text>
          <Box>
            <Text size="2" weight="bold" className="text-neutral-l2">
              {ticket.subject}
            </Text>
          </Box>
          {!!ticket?.description && (
            <Box>
              <Text size="1" weight="medium" className="text-neutral-l2 line-clamp-2">
                {ticket?.description}
              </Text>
            </Box>
          )}
        </Box>

        {/* Status */}
        <Flex align="center" justify="between">
          {!!ticket?.status && (
            <Text size="1" className="text-neutral-alpha mt-2 w-1/2  font-bold">
              Status :{' '}
              <span className="text-neutral-alpha font-medium capitalize opacity-60">
                {ticket.status}
              </span>
            </Text>
          )}

          {!!ticket?.category && (
            <Text size="1" className="text-neutral-alpha mt-2 w-1/2  font-bold">
              Category :{' '}
              <span className="text-neutral-alpha font-medium capitalize opacity-60">
                {ticket?.category}
              </span>
            </Text>
          )}
        </Flex>
      </Box>
    </Link>
  );
};

export default TicketCard;
