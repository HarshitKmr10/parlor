import { useState, useEffect } from 'react';

import { useGlobalContext } from 'contexts/store';
import { serviceDeskInstance } from 'api/common/axiosInstance';
import { Ticket } from 'types/performanceTypes';

interface UserDetails {
  fullName: string;
  mobilePhone: string;
  email: string;
  employeeId: string;
}

class EmployeeTicketsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmployeeTicketsError';
  }
}

export const useEmployeeTickets = (
  userSysId: string,
  integration: string,
  userDetails: UserDetails,
) => {
  const { user } = useGlobalContext();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchTicketsByUserSysId = async () => {
      // Skip if userSysId is empty, null, or a placeholder value like '-'
      if (!userSysId || userSysId === '-' || userSysId.trim() === '') {
        setTickets([]); // Clear any existing tickets
        setLoadingTickets(false);
        return;
      }

      // Add null check for user to prevent TypeError
      if (!user || !user.org_id) {
        console.warn('User or user.org_id is not available, cannot fetch tickets');
        setLoadingTickets(false);
        return;
      }

      setLoadingTickets(true);
      
      try {
        let data;
        if (integration === 'ServiceNow') {
          // Use backend ServiceNow API with query parameters
          const params = new URLSearchParams({
            org_id: user.org_id,
            caller_id: userSysId,
            limit: '10' // Reasonable limit for tickets
          });
          const url = `/servicenow/search_incidents?${params.toString()}`;
          const response = await serviceDeskInstance.get(url);
          data = response.data;
        } else {
          // Keep FreshService as is
          const url = '/api/getFreshServiceTickets';
          const body = { requesterId: userSysId };
          const response = await serviceDeskInstance.post(url, body);
          data = response.data;
        }

        const instanceName = integration === 'ServiceNow' 
          ? data.instance_name 
          : data.instanceName;

        const ticketsArray = integration === 'ServiceNow' 
          ? data.incidents 
          : data.tickets;

        const formattedTickets: Ticket[] = ticketsArray.map((ticket: any) => {
          const employeeLink = integration === 'ServiceNow'
            ? `https://${instanceName}.service-now.com/now/nav/ui/classic/params/target/sys_user.do%3Fsys_id%3D${
              ticket.caller_id?.value || ''
            }`
            : ''; // Add FreshService link if applicable

          const ticketLink = integration === 'ServiceNow'
            ? `https://${instanceName}.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3D${
              ticket.sys_id || ''
            }`
            : ''; // Add FreshService link if applicable

          return {
            taskTitle: ticket.subject || ticket.short_description,
            taskStatus: ticket.status || ticket.incident_state,
            responseDue: ticket.due_by || ticket.activity_due,
            taskCreator: userDetails.fullName,
            taskNumber: ticket.id || ticket.task_effective_number,
            createdOn: ticket.created_at || ticket.opened_at,
            employeeLink,
            ticketLink,
          };
        });

        formattedTickets.sort(
          (a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime(),
        );

        setTickets(formattedTickets);
      } catch (err) {
        console.error(`Error fetching tickets for ${integration}:`, err);
        setError(new EmployeeTicketsError(`Failed to fetch tickets for ${integration}: ${err instanceof Error ? err.message : 'Unknown error'}`));
        setTickets([]);
      } finally {
        setLoadingTickets(false);
      }
    };

    fetchTicketsByUserSysId();
  }, [userSysId, integration, user, userDetails.fullName]);

  return { tickets, loadingTickets, error };
};
