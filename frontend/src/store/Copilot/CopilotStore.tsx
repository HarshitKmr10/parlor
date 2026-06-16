'use client';

import { PropsWithChildren, createContext, useContext, useState, useEffect } from 'react';
import { StoreApi, createStore, useStore } from 'zustand';
import { useSearchParams } from 'next/navigation';
import { useGlobalContext } from 'contexts/store';
import { UserDetails } from 'types/common';
import { API } from 'api';
import { UserData } from 'types/userTypes';
import { Meeting } from 'types/meetingTypes';
import { coPilotInstance } from 'api/common/axiosInstance';

class UserDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserDataError';
  }
}

type CopilotStore = {
  // Meeting and User Data
  meetingId: string | null;
  isUserLoading: boolean;
  meeting: Meeting | null;
  userDetails: UserDetails | null;
  
  // User not found state
  userNotFound: boolean;
  showUserSearchModal: boolean;
  
  // Error handling
  error: Error | null;
  
  // Configuration
  integration: string;
  
  // Actions
  setMeetingId: (meetingId: string | null) => void;
  setConfig: (config: {
    integration?: string;
  }) => void;
  fetchMeetingAndUserDetails: () => Promise<void>;
  refetch: () => Promise<void>;
  reset: () => void;
  setShowUserSearchModal: (show: boolean) => void;
  
  // Helper functions (internal use)
  createUser: (phoneNumber: string) => Promise<UserData | null>;
  fetchOrCreateUserByPhoneNumber: (phoneNumber: string) => Promise<UserData | null>;
  searchUserByEmailOrEmployeeNumber: (email?: string, employeeNumber?: string, userId?: string) => Promise<UserData | null>;
  createTicket: (ticketData: {
    phoneNumber?: string;
    shortDescription: string;
    description: string;
    category?: string;
    priority?: number;
    urgency: number;
    impact: number;
    assignmentGroup?: string;
  }) => Promise<{ success: boolean; ticketLink?: string; error?: string }>;
  updateTicket: (ticketData: {
    ticketNumber: string;
    phoneNumber?: string;
    shortDescription: string;
    description: string;
    category?: string;
    priority?: number;
    urgency?: number;
    impact?: number;
    workNotes?: string;
  }) => Promise<{ success: boolean; error?: string }>;
};

const CopilotContext = createContext<StoreApi<CopilotStore> | undefined>(undefined);

export const CopilotProvider = ({ children }: PropsWithChildren) => {
  const { user } = useGlobalContext();
  const searchParams = useSearchParams();
  const meetingIdFromParams = searchParams.get('meetingId');

  const [store] = useState(() =>
    createStore<CopilotStore>((set, get) => ({
      // Initial state
      meetingId: meetingIdFromParams,
      isUserLoading: true,
      meeting: null,
      userDetails: {
        fullName: '',
        mobilePhone: '',
        email: '',
        employeeId: '',
        employeeNumber: '',
      },
      userNotFound: false,
      showUserSearchModal: false,
      error: null,
      
      // Configuration
      integration: '',

      // Actions
      setMeetingId: (meetingId) => set({ meetingId }),
      
      setConfig: (config) => set((state) => ({
        integration: config.integration ?? state.integration,
      })),

      setShowUserSearchModal: (show) => set({ showUserSearchModal: show }),

      // Helper function to create user
      createUser: async (phoneNumber: string): Promise<UserData | null> => {
        const url = '/api/createUser';
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber, user }),
          });

          if (!response.ok) {
            set({ error: new UserDataError(`Failed to create user: HTTP error ${response.status}`) });
            return null;
          }

          const data = await response.json();
          
          if (!data || !data.user) {
            return null;
          }
          
          return data.user;
        } catch (e: any) {
          set({ error: new UserDataError(`Failed to create user: ${e.message}`) });
          return null;
        }
      },

      // Helper function to fetch or create user
      fetchOrCreateUserByPhoneNumber: async (phoneNumber: string): Promise<UserData | null> => {
        try {
          // Step 1: Try to get user from the new endpoint
          const response = await coPilotInstance.post('/api/users/get-user-by-phone', {
            phone_number: phoneNumber,
          });
          if (response?.data && response?.data?.user && Array.isArray(response?.data.user) && response?.data?.user?.length > 0) {
            const user = response?.data?.user[0]; // Take the first user
            set({ userNotFound: false });
            return user;
          } else {
            // User not found - set flag to show search modal
            set({ userNotFound: true, showUserSearchModal: true });
            return null;
          }
        } catch (e: any) {
          set({ error: new UserDataError(`Failed to fetch or create user: ${e.message}`), userNotFound: true });
          return null;
        }
      },

      // Helper function to search user by email, employee number, or user_id
      searchUserByEmailOrEmployeeNumber: async (email?: string, employeeNumber?: string, userId?: string): Promise<UserData | null> => {
        try {
          const response = await coPilotInstance.post('/api/users/get-user-by-phone', {
            email: email || undefined,
            employee_number: employeeNumber || undefined,
            user_id: userId || undefined,
          });
          
          if (response?.data && response?.data?.user && Array.isArray(response?.data.user) && response?.data?.user?.length > 0) {
            const user = response?.data?.user[0];
            
            // Update user details in store
            set({
              userDetails: {
                fullName: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Unknown User',
                mobilePhone: user?.mobile_phone || '',
                email: user?.email || '',
                employeeId: user?.sys_id || '',
                employeeNumber: user?.employee_number || '',
              },
              userNotFound: false,
              showUserSearchModal: false,
            });
            
            return user;
          } else {
            return null;
          }
        } catch (e: any) {
          set({ error: new UserDataError(`Failed to search user: ${e.message}`) });
          return null;
        }
      },

      createTicket: async (ticketData) => {
        try {
          const userSysId = get().userDetails?.employeeId || undefined;
          const response = await coPilotInstance.post('/api/users/create-ticket-from-phone', {
            phone_number: ticketData.phoneNumber || undefined,
            user_sys_id: userSysId,
            short_description: ticketData.shortDescription,
            description: ticketData.description,
            category: ticketData.category,
            priority: ticketData.priority,
            urgency: ticketData.urgency,
            impact: ticketData.impact,
            assignment_group: ticketData.assignmentGroup || 'Service Desk',
          });

          const data = response?.data;

          if (data?.success && data?.ticket) {
            // Construct ticket link from the ticket number if available
            const ticketLink = data.ticket.number 
              ? `${window.location.origin}/ticket/${data.ticket.number}`
              : '';
            
            return {
              success: true,
              ticketLink: ticketLink || data.ticket_link || '',
            };
          } else {
            return {
              success: false,
              error: data?.message || 'Failed to create ticket',
            };
          }
        } catch (e: any) {
          return {
            success: false,
            error: e.response?.data?.message || e.message || 'Failed to create ticket',
          };
        }
      },

      updateTicket: async (ticketData) => {
        try {
          const userSysId = get().userDetails?.employeeId || undefined;
          const response = await coPilotInstance.post('/api/users/update-ticket', {
            ticket_number: ticketData.ticketNumber,
            phone_number: ticketData.phoneNumber || undefined,
            user_sys_id: userSysId,
            short_description: ticketData.shortDescription,
            description: ticketData.description,
            urgency: ticketData.urgency,
            impact: ticketData.impact,
            work_notes: ticketData.workNotes || `Updated: ${ticketData.description}`,
          });

          const data = response?.data;

          if (data?.success) {
            return {
              success: true,
            };
          } else {
            return {
              success: false,
              error: data?.message || 'Failed to update ticket',
            };
          }
        } catch (e: any) {
          return {
            success: false,
            error: e.response?.data?.message || e.message || 'Failed to update ticket',
          };
        }
      },

      fetchMeetingAndUserDetails: async () => {
        const { meetingId } = get();
        if (!meetingId) return;

        set({ isUserLoading: true, error: null });
        
        try {
          const meetData = await API.Meetings.GetMeetingsByID(meetingId, user);

          if (!meetData || typeof meetData !== 'object') {
            set({
              error: new UserDataError('Invalid meeting data received'),
              meeting: null,
              userDetails: {
                fullName: '',
                mobilePhone: '',
                email: '',
                employeeId: '',
                employeeNumber: '',
              },
            });
            return;
          }

          set({ meeting: meetData });

          if (meetData.phone_number) {
            const userData = await get().fetchOrCreateUserByPhoneNumber(meetData?.phone_number);
            
            if (userData) {
              set({
                userDetails: {
                  fullName: `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim() || 'Unknown User',
                  mobilePhone: userData?.mobile_phone || meetData?.phone_number || '',
                  email: userData?.email || '',
                  employeeId: userData?.sys_id || '',
                  employeeNumber: userData?.employee_number || '',
                },
              });
            } else {
              // If userData is null but we have phone number, set partial details
              set({
                userDetails: {
                  fullName: 'Unknown User',
                  mobilePhone: meetData.phone_number || '',
                  email: '',
                  employeeId: '',
                  employeeNumber: '',
                },
              });
            }
          } else {
            set({
              userDetails: {
                fullName: '',
                mobilePhone: '',
                email: '',
                employeeId: '',
                employeeNumber: '',
              },
            });
          }
        } catch (e: any) {
          set({
            error: new UserDataError(`Failed to fetch meeting and user details: ${e.message}`),
            meeting: null,
            userDetails: {
              fullName: '',
              mobilePhone: '',
              email: '',
              employeeId: '',
              employeeNumber: '',
            },
          });
        } finally {
          set({ isUserLoading: false });
        }
      },


      refetch: async () => {
        await get().fetchMeetingAndUserDetails();
      },

      reset: () => {
        set({
          meetingId: null,
          isUserLoading: true,
          meeting: null,
          userDetails: {
            fullName: '',
            mobilePhone: '',
            email: '',
            employeeId: '',
            employeeNumber: '',
          },
          userNotFound: false,
          showUserSearchModal: false,
          error: null,
          integration: '',
        });
      },
    })),
  );

  // Sync meetingId from params
  useEffect(() => {
    if (meetingIdFromParams) {
      store.getState().setMeetingId(meetingIdFromParams);
    }
  }, [meetingIdFromParams, store]);

  // Fetch initial data when meetingId is available
  useEffect(() => {
    const state = store.getState();
    if (state.meetingId) {
      state.fetchMeetingAndUserDetails();
    }
  }, [store]);

  // Fetch device details when userDetails changes
  useEffect(() => {
    let previousUserDetails = store.getState().userDetails;
    
    const unsubscribe = store.subscribe((state) => {
      const currentUserDetails = state.userDetails;
      
      // Check if userDetails changed and has employeeId
      if (currentUserDetails?.employeeId && currentUserDetails !== previousUserDetails) {
        previousUserDetails = currentUserDetails;
        // Device details are now handled by DevicesStore
      }
    });

    return () => unsubscribe();
  }, [store]);

  return (
    <CopilotContext.Provider value={store}>{children}</CopilotContext.Provider>
  );
};

export function useCopilotStore<T>(selector: (state: CopilotStore) => T) {
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error('CopilotProvider is missing');
  }
  return useStore(context, selector);
}

export function useSafeCopilotStore<T>(selector: (state: CopilotStore) => T, defaultValue: T): T {
  const context = useContext(CopilotContext);
  if (!context) {
    return defaultValue;
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useStore(context, selector);
}

