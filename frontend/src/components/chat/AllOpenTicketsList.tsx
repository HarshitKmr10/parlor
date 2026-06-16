import React, { useMemo } from 'react';
import {
  Badge, Flex, Link, Text,
} from '@radix-ui/themes';
import Spinner from 'components/spinner/spinner';
import { formatDate } from 'utils/dateUtils';
import { truncateMessage } from 'utils/stringUtils';

/**
 * @typedef Ticket
 * @property {string} taskTitle - Short description of the ticket.
 * @property {string} taskStatus - The current state of the ticket.
 * @property {Date} responseDue - Date by which a response is due.
 * @property {string} taskNumber - Effective number of the task.
 * @property {string} createdOn - Date the ticket was opened.
 * @property {string} employeeId - ID of the employee who opened the ticket.
 * @property {string} employeeLink - URL to the employee's profile.
 * @property {string} ticketId - System ID of the ticket.
 * @property {string} ticketLink - URL to access the ticket.
 */

/**
 * @typedef Props
 * @property {Ticket[]} allTickets - Array of ticket objects.
 * @property {boolean} loading - Indicates if the ticket data is loading.
 */

/**
 * Renders a list of all open tickets.
 * @param {Props} props The props passed to the component.
 */
function AllOpenTicketsList({ allTickets = [], loading, instanceName }) {
  const formattedTickets = useMemo(() => {
    if (!allTickets) return [];
    return allTickets
      .map((ticket) => ({
        taskTitle: ticket.short_description,
        taskStatus: ticket.incident_state,
        responseDue: ticket.activity_due,
        taskNumber: ticket.task_effective_number,
        createdOn: formatDate(ticket.opened_at),
        employeeId: ticket.caller_id?.value || '---',
        employeeName: ticket['caller_id.name'] || 'No name',
        employeeLink: `https://${instanceName}.service-now.com/nav_to.do?uri=/sys_user.do?sys_id=${ticket.caller_id.value}`,
        ticketId: ticket.sys_id,
        ticketLink: `https://${instanceName}.service-now.com/nav_to.do?uri=/incident.do?sys_id=${ticket.sys_id}`,
      }))
      .sort(
        (a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime(),
      );
  }, [allTickets]);
  return (
    <div className="overflow-y-auto" style={{ height: 'calc(100vh - 9.5rem)' }}>
      {loading && <Spinner />}
      {formattedTickets.length === 0 && !loading && (
        <Flex direction="column">
          <Text size="1" align="center">
          Please enter user details to fetch tickets
          </Text>
        </Flex>
      )}
      <Flex m="3" direction="column" gap="2">
        {formattedTickets.map((ticket) => (
          <a
            href={ticket.ticketLink}
            className="block"
            target="_blank"
            key={ticket.ticketId}
          >
            <Flex
              key={ticket.ticketLink}
              direction="column"
              p="3"
              className="mt-3 first:mt-0 bg-[var(--accent-3)] hover:bg-[var(--accent-4)] border-l-5 border-[var(--accent-11)]"
            >
              <Flex justify="between">
                <Text size="2" weight="bold">
                  {truncateMessage(ticket.taskTitle, 50)}
                </Text>
                <Badge>Open</Badge>
              </Flex>
              <div className="flex items-baseline">
                <Link href={ticket.employeeLink} size="1" target="_blank">
                  {ticket.employeeName}
                </Link>
                <Text mx="1" color="gray">
                  |
                </Text>
                <Link href={ticket.ticketLink} size="1" target="_blank">
                  #
                  {ticket.taskNumber}
                </Link>
                <Text mx="1" color="gray">
                  |
                </Text>
                <Text size="1" className="text-[var(--accent-3)]">
                  {formatDate(ticket.createdOn)}
                </Text>
              </div>
            </Flex>
          </a>
        ))}
      </Flex>
    </div>
  );
}

export default AllOpenTicketsList;
