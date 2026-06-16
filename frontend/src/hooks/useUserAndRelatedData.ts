import {
  useState, useEffect, useCallback, useMemo,
} from 'react';
import { useGlobalContext } from 'contexts/store';
import { fetchData } from 'utils/apiUtils';
import { UserDetails } from 'types/common';
import { Ticket } from 'types/performanceTypes';
import { API } from 'api';
import { coPilotInstance } from 'api/common/axiosInstance';
import { UserData } from 'types/userTypes';
import { Meeting } from 'types/meetingTypes';

class UserDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserDataError';
  }
}

const useUserAndRelatedData = (
  meetingId: string,
  integration: string,
  endpointManagement: boolean,
  endpointSystem: string,
  fetchDeviceInfo = true,
  fetchTicketsDetails = true,
) => {
  const { user } = useGlobalContext();
  const [isUserLoading, setIsUserLoading] = useState<boolean>(true);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>({
    fullName: '',
    mobilePhone: '',
    email: '',
    employeeId: '',
    employeeNumber: '',
  });
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState<boolean>(false);
  const [deviceDetails, setDeviceDetails] = useState([]);
  const [loadingDeviceDetails, setLoadingDeviceDetails] = useState<boolean>(
    false,
  );
  const [error, setError] = useState<Error | null>(null);

  const fetchOrCreateUserByPhoneNumber = useCallback(
    async (phoneNumber: string): Promise<UserData | null> => {
      try {
        // Use copilot backend API (same as livecall) for consistent ServiceNow lookup
        console.log('[useUserAndRelatedData] Fetching user by phone:', phoneNumber);
        const response = await coPilotInstance.post('/api/users/get-user-by-phone', {
          phone_number: phoneNumber,
        });
        console.log('[useUserAndRelatedData] API response:', response?.data);

        if (response?.data?.success && response?.data?.user?.length > 0) {
          const userData = response.data.user[0];
          console.log('[useUserAndRelatedData] User found:', userData?.first_name, userData?.last_name);
          return userData;
        }
        
        // User not found - return null (don't auto-create)
        console.log('[useUserAndRelatedData] No user found');
        return null;
      } catch (e: any) {
        console.error('Error fetching user details:', e.message);
        setError(
          new UserDataError(
            `Failed to fetch user: ${
              e instanceof Error ? e.message : 'Unknown error'
            }`,
          ),
        );
        return null;
      }
    },
    [],
  );

  const fetchMeetingAndUserDetails = useCallback(async () => {
    setIsUserLoading(true);
    setError(null);
    try {
      const meetData = await API.Meetings.GetMeetingsByID(meetingId, user);

      if (!meetData || typeof meetData !== 'object') {
        console.error('Invalid meeting data received');
        setError(new UserDataError('Invalid meeting data received'));
        setMeeting(null);
        setUserDetails({
          fullName: '',
          mobilePhone: '',
          email: '',
          employeeId: '',
          employeeNumber: '',
        });
        return;
      }

      setMeeting(meetData);
      console.log('[useUserAndRelatedData] Meeting data phone_number:', meetData.phone_number);

      if (meetData.phone_number) {
        const userData = await fetchOrCreateUserByPhoneNumber(
          meetData.phone_number,
        );
        console.log('[useUserAndRelatedData] userData returned:', userData);
        if (userData) {
          const newUserDetails = {
            fullName: `${userData.first_name} ${userData.last_name}`,
            mobilePhone: userData.mobile_phone,
            email: userData.email,
            employeeId: userData.sys_id,
            employeeNumber: userData.employee_number,
          };
          console.log('[useUserAndRelatedData] Setting userDetails:', newUserDetails);
          setUserDetails(newUserDetails);
        } else {
          console.log('[useUserAndRelatedData] userData is null, not setting userDetails');
        }
      } else {
        console.log('[useUserAndRelatedData] No phone_number in meeting data');
        setUserDetails({
          fullName: '',
          mobilePhone: '',
          email: '',
          employeeId: '',
          employeeNumber: '',
        });
      }
    } catch (e) {
      console.error('Error fetching meeting and user details:', e);
      setError(
        new UserDataError(
          `Failed to fetch meeting and user details: ${
            e instanceof Error ? e.message : 'Unknown error'
          }`,
        ),
      );
      setMeeting(null);
      setUserDetails({
        fullName: '',
        mobilePhone: '',
        email: '',
        employeeId: '',
        employeeNumber: '',
      });
    } finally {
      setIsUserLoading(false);
    }
  }, [meetingId, user, fetchOrCreateUserByPhoneNumber]);

  const fetchTickets = useCallback(async () => {
    if (
      !userDetails?.employeeId
      || !fetchTicketsDetails
      || userDetails?.employeeId.length === 0
    ) return;
    setLoadingTickets(true);
    setError(null);
    const url = integration === 'FreshService'
      ? '/api/getFreshServiceTickets'
      : '/api/getNewTickets';
    const body = integration === 'ServiceNow'
      ? { userSysId: userDetails.employeeId, user }
      : { requesterId: userDetails.employeeId };
    try {
      const data = await fetchData(url, 'POST', body);
      if (!data || !Array.isArray(data.tickets)) {
        console.error(`Invalid ticket data received for ${integration}`);
        setError(
          new UserDataError(`Invalid ticket data received for ${integration}`),
        );
        setTickets([]);
        return;
      }
      const formattedTickets: Ticket[] = data.tickets.map((ticket: any) => ({
        taskTitle: ticket.subject || ticket.short_description,
        taskStatus: ticket.status || ticket.incident_state,
        responseDue: ticket.due_by || ticket.activity_due,
        taskCreator: userDetails.fullName,
        taskNumber: ticket.id || ticket.task_effective_number,
        createdOn: ticket.created_at || ticket.opened_at,
      }));
      formattedTickets.sort(
        (a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime(),
      );
      setTickets(formattedTickets);
    } catch (e) {
      console.error(`Error fetching tickets for ${integration}:`, e);
      setError(
        new UserDataError(
          `Failed to fetch tickets for ${integration}: ${
            e instanceof Error ? e.message : 'Unknown error'
          }`,
        ),
      );
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  }, [userDetails, integration, user, fetchTicketsDetails]);

  const fetchDeviceDetails = useCallback(async () => {
    if (
      !userDetails?.email
      || !endpointManagement
      || endpointSystem !== 'Intune'
      || !fetchDeviceInfo
      || userDetails?.email.length === 0
    ) return;
    setLoadingDeviceDetails(true);
    setError(null);

    try {
      const data = await fetchData('/api/getDeviceInfo', 'POST', {
        email: userDetails.email,
      });
      setDeviceDetails(data.deviceInfo || []);
    } catch (e) {
      console.error('Error fetching device details:', e);
      setError(
        new UserDataError(
          `Failed to fetch device details: ${
            e instanceof Error ? e.message : 'Unknown error'
          }`,
        ),
      );
      setDeviceDetails([]);
    } finally {
      setLoadingDeviceDetails(false);
    }
  }, [userDetails, endpointManagement, endpointSystem, fetchDeviceInfo]);

  useEffect(() => {
    fetchMeetingAndUserDetails();
  }, [fetchMeetingAndUserDetails]);

  useEffect(() => {
    if (userDetails && meetingId) {
      fetchTickets();
      fetchDeviceDetails();
    }
  }, [userDetails, meetingId, fetchTickets, fetchDeviceDetails]);

  return useMemo(
    () => ({
      isUserLoading,
      meeting,
      userDetails,
      tickets,
      loadingTickets,
      deviceDetails,
      loadingDeviceDetails,
      error,
    }),
    [
      isUserLoading,
      meeting,
      userDetails,
      tickets,
      loadingTickets,
      deviceDetails,
      loadingDeviceDetails,
      error,
    ],
  );
};

export default useUserAndRelatedData;
