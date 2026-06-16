'use client';

import { PropsWithChildren, createContext, useContext, useState } from 'react';
import { StoreApi, createStore, useStore } from 'zustand';
import { fetchData } from 'utils/apiUtils';
import { Ticket, OnCallTicket } from 'types/performanceTypes';
import { coPilotInstance } from 'api/common/axiosInstance';
import { toast } from 'react-toastify';

class TicketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TicketError';
  }
}

type TicketsStore = {
  // Tickets Data
  tickets: Ticket[];
  loadingTickets: boolean;
  
  // Created Tickets Data (tickets created after meeting started) - uses OnCallTicket type
  createdTickets: OnCallTicket[];
  loadingCreatedTickets: boolean;
  
  // Configuration
  integration: string;
  fetchTicketsDetails: boolean;
  
  // Actions
  setConfig: (config: {
    integration?: string;
    fetchTicketsDetails?: boolean;
  }) => void;
  fetchTickets: (userDetails: {
    employeeId?: string;
    mobilePhone?: string;
    fullName?: string;
    email?: string;
    employeeNumber?: string;
  }) => Promise<void>;
  fetchCreatedTickets: (userDetails: {
    employeeId?: string;
    mobilePhone?: string;
    fullName?: string;
    email?: string;
    employeeNumber?: string;
    meetingStartTime: string;
    meetingId?: string;
  }) => Promise<void>;
  clearTickets: () => void;
  clearCreatedTickets: () => void;
};

const TicketsContext = createContext<StoreApi<TicketsStore> | undefined>(undefined);

export const TicketsProvider = ({ children }: PropsWithChildren) => {
  const [store] = useState(() =>
    createStore<TicketsStore>((set, get) => ({
      // Initial state
      tickets: [],
      loadingTickets: false,
      
      // Created Tickets state
      createdTickets: [],
      loadingCreatedTickets: false,
      
      // Configuration
      integration: '',
      fetchTicketsDetails: true,

      // Actions
      setConfig: (config) => set((state) => ({
        integration: config.integration ?? state.integration,
        fetchTicketsDetails: config.fetchTicketsDetails ?? state.fetchTicketsDetails,
      })),

      clearTickets: () => set({ tickets: [] }),
      clearCreatedTickets: () => set({ createdTickets: [] }),

      fetchTickets: async (userDetails) => {
        const { fetchTicketsDetails, integration } = get();
        
        if (
          !userDetails?.employeeId ||
          !fetchTicketsDetails ||
          userDetails?.employeeId.length === 0
        ) return;

        set({ loadingTickets: true });
        
        // Use the new unified endpoint for ServiceNow
        if (integration === 'ServiceNow') {
          try {
            // Build request payload with available identifiers
            // The endpoint accepts phone_number, email, employee_number, or user_id
            const requestPayload: any = {
              create_if_not_exists: false,
              include_tickets: true,
              ticket_limit: 5,
            };

            // Prioritize phone_number if available, otherwise use other identifiers
            if (userDetails.mobilePhone) {
              requestPayload.phone_number = userDetails.mobilePhone;
            } else if (userDetails.email) {
              requestPayload.email = userDetails.email;
            } else if (userDetails.employeeNumber) {
              requestPayload.employee_number = userDetails.employeeNumber;
            } else if (userDetails.employeeId) {
              // If we only have sys_id, we can't use it directly in lookup-by-phone
              // but we should still try with what we have
              // The backend will handle the lookup and use sys_id to fetch tickets
              // For now, skip if we only have employeeId without other identifiers
              set({ loadingTickets: false, tickets: [] });
              return;
            } else {
              // No identifiers available
              set({ loadingTickets: false, tickets: [] });
              return;
            }

            const response = await coPilotInstance.post('/api/users/lookup-by-phone', requestPayload);

            const data = response.data;

            if (data.success && data.tickets && Array.isArray(data.tickets)) {
              const formattedTickets: Ticket[] = data.tickets.map((ticket: any) => ({
                taskTitle: ticket.short_description || ticket.subject,
                taskStatus: ticket.incident_state || ticket.status,
                responseDue: ticket.activity_due || ticket.due_by,
                taskCreator: userDetails.fullName || '',
                taskNumber: ticket.task_effective_number || ticket.number || ticket.id,
                createdOn: ticket.opened_at || ticket.created_at,
                description: ticket?.description,
                taskCategory: ticket?.category,
                taskPriority: ticket?.priority,
                taskUrgency: ticket?.urgency,
                taskImpact: ticket?.impact,
              }));

              formattedTickets.sort(
                (a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime(),
              );

              set({ tickets: formattedTickets });
            } else {
              set({ tickets: [] });
            }
          } catch (e: any) {
            // Show toast notification instead of throwing error
            if (e.response?.status === 404) {
              toast.info('Ticket service is currently unavailable. Please try again later.');
            } else if (e.response?.status >= 500) {
              toast.error('Server error occurred while fetching tickets. Please try again later.');
            } else {
              toast.error('Unable to fetch tickets. Please check your connection and try again.');
            }
            
            set({ tickets: [] });
          } finally {
            set({ loadingTickets: false });
          }
          return;
        }

        // Fallback to legacy endpoints for other integrations
        const url = integration === 'FreshService'
          ? '/api/getFreshServiceTickets'
          : '/api/getNewTickets';
        const body = integration === 'ServiceNow'
          ? { userSysId: userDetails.employeeId }
          : { requesterId: userDetails.employeeId };

        try {
          const data = await fetchData(url, 'POST', body);
          
          if (!data || !Array.isArray(data.tickets)) {
            toast.warning(`Invalid ticket data received for ${integration}`);
            set({ tickets: [] });
            return;
          }

          const formattedTickets: Ticket[] = data.tickets.map((ticket: any) => ({
            taskTitle: ticket.subject || ticket.short_description,
            taskStatus: ticket.status || ticket.incident_state,
            responseDue: ticket.due_by || ticket.activity_due,
            taskCreator: userDetails.fullName || '',
            taskNumber: ticket.id || ticket.task_effective_number,
            createdOn: ticket.created_at || ticket.opened_at,
            description: ticket?.description,
            taskCategory: ticket?.category,
            taskPriority: ticket?.priority,
            taskUrgency: ticket?.urgency,
            taskImpact: ticket?.impact,
          }));

          formattedTickets.sort(
            (a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime(),
          );

          set({ tickets: formattedTickets });
        } catch (e: any) {
          // Show toast notification instead of throwing error
          toast.error(`Unable to fetch tickets from ${integration}. Please try again later.`);
          set({ tickets: [] });
        } finally {
          set({ loadingTickets: false });
        }
      },

      fetchCreatedTickets: async (userDetails) => {
        const { fetchTicketsDetails, integration } = get();
        
        if (
          !userDetails?.employeeId ||
          !fetchTicketsDetails ||
          !userDetails?.meetingStartTime ||
          userDetails?.employeeId.length === 0
        ) return;

        set({ loadingCreatedTickets: true });
        
        // ServiceNow: choose endpoint based on presence of meetingId
        if (integration === 'ServiceNow') {
          try {
            const useOnCallEndpoint = Boolean(userDetails.meetingId);

            if (useOnCallEndpoint) {
              // Use get-oncall-tickets endpoint - returns OnCallTicket format
              // This endpoint accepts user_sys_id directly, so we can use employeeId
              // It also accepts phone_number as alternative, but user_sys_id is preferred
              const response = await coPilotInstance.post('/api/users/get-oncall-tickets', {
                meeting_id: userDetails.meetingId,
                meeting_started_time: userDetails.meetingStartTime,
                phone_number: userDetails.mobilePhone || undefined,
                user_sys_id: userDetails.employeeId,
                limit: 50,
              });

              const data = response.data;

              if (data.success && data.tickets && Array.isArray(data.tickets)) {
                // Use OnCallTicket type directly - no mapping needed
                const tickets: OnCallTicket[] = data.tickets;

                // Sort by ticket number (newest first based on INC number)
                tickets.sort((a, b) => b.ticket_number.localeCompare(a.ticket_number));

                set({ createdTickets: tickets });
              } else {
                set({ createdTickets: [] });
              }
            } else {
              // Use lookup-by-phone endpoint - returns legacy format, needs mapping
              // Note: This endpoint doesn't support created_after filtering, so we filter on frontend
              
              // Helper function to filter tickets by meeting start time
              const filterTicketsByDate = (tickets: any[]) => {
                if (!userDetails.meetingStartTime) return tickets;
                const meetingStartTime = new Date(userDetails.meetingStartTime);
                return tickets.filter((ticket: any) => {
                  const ticketCreated = new Date(ticket.opened_at || ticket.created_at || ticket.sys_created_on);
                  return ticketCreated >= meetingStartTime;
                });
              };

              // Build request payload with available identifiers
              const requestPayload: any = {
                create_if_not_exists: false,
                include_tickets: true,
                ticket_limit: 50,
              };

              // Prioritize phone_number if available, otherwise use other identifiers
              if (userDetails.mobilePhone) {
                requestPayload.phone_number = userDetails.mobilePhone;
              } else if (userDetails.email) {
                requestPayload.email = userDetails.email;
              } else if (userDetails.employeeNumber) {
                requestPayload.employee_number = userDetails.employeeNumber;
              } else {
                // No identifiers available - can't use lookup-by-phone endpoint
                set({ loadingCreatedTickets: false, createdTickets: [] });
                return;
              }

              const response = await coPilotInstance.post('/api/users/lookup-by-phone', requestPayload);
              const data = response.data;

              if (data.success && data.tickets && Array.isArray(data.tickets)) {
                // Filter tickets by meeting start time (frontend filtering since backend doesn't support created_after)
                const filteredTickets = filterTicketsByDate(data.tickets);
                
                // Map legacy format to OnCallTicket format
                const tickets: OnCallTicket[] = filteredTickets.map((ticket: any) => ({
                  ticket_id: ticket.sys_id || ticket.id,
                  ticket_number: ticket.number || ticket.task_effective_number,
                  title: ticket.short_description || ticket.subject,
                  description: ticket.description || '',
                  category: ticket.category || '',
                  resolver_group: ticket.assignment_group || { link: '', value: '' },
                  priority: parseInt(ticket.priority) || 3,
                  urgency: parseInt(ticket.urgency) || 3,
                  work_notes: ticket.work_notes || '',
                  update_type: 'legacy',
                  confidence_score: 0,
                  reasoning: '',
                  related_to_vva: false,
                  ticket_display_info: {
                    short_description: ticket.short_description || '',
                    category: ticket.category || '',
                    channel: ticket.channel || 'phone',
                    state: ticket.incident_state || ticket.state || '',
                    impact: parseInt(ticket.impact) || 3,
                    urgency: parseInt(ticket.urgency) || 3,
                    priority: parseInt(ticket.priority) || 3,
                    assigned_to: ticket.assigned_to || '',
                    assignment_group: ticket.assignment_group || { link: '', value: '' },
                  },
                }));

                // Sort by ticket number (newest first)
                tickets.sort((a, b) => b.ticket_number.localeCompare(a.ticket_number));

                set({ createdTickets: tickets });
              } else {
                set({ createdTickets: [] });
              }
            }
          } catch (e: any) {
            // Show toast notification instead of throwing error
            if (e.response?.status === 404) {
              toast.info('Ticket service is currently unavailable. Please try again later.');
            } else if (e.response?.status >= 500) {
              toast.error('Server error occurred while fetching created tickets. Please try again later.');
            } else {
              toast.error('Unable to fetch created tickets. Please check your connection and try again.');
            }
            
            set({ createdTickets: [] });
          } finally {
            set({ loadingCreatedTickets: false });
          }
          return;
        }

        // Fallback for other integrations (if needed)
        // For now, we'll set empty array as other integrations may not support this feature yet
        set({ createdTickets: [], loadingCreatedTickets: false });
      },
    })),
  );

  return (
    <TicketsContext.Provider value={store}>{children}</TicketsContext.Provider>
  );
};

export function useTicketsStore<T>(selector: (state: TicketsStore) => T) {
  const context = useContext(TicketsContext);
  if (!context) {
    throw new Error('TicketsProvider is missing');
  }
  return useStore(context, selector);
}
