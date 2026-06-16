import { useState, useCallback, useEffect } from 'react';
import { useGlobalContext } from 'contexts/store';
import { fetchData } from 'utils/apiUtils';
import { serviceDeskInstance } from 'api/common/axiosInstance';

interface UserDetails {
  fullName: string;
  mobilePhone: string;
  email: string;
  employeeId: string;
  employeeNumber?: string;
}

class UserDetailsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserDetailsError';
  }
}

export const useUserDetails = (ticketingSystem: string) => {
  const { user } = useGlobalContext();
  const [userDetails, setUserDetails] = useState<UserDetails>({
    fullName: '',
    mobilePhone: '',
    email: '',
    employeeId: '',
    employeeNumber: ''
  });
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUserByEmployeeId = useCallback(
    async (employeeId: string) => {
      // Skip if employeeId is empty, null, or a placeholder value like '-'
      if (!employeeId || employeeId === '-' || employeeId.trim() === '') {
        throw new UserDetailsError('Employee ID is required');
      }

      // Add null check for user to prevent TypeError
      if (!user || !user.org_id) {
        console.warn('User or user.org_id is not available, cannot fetch user details');
        throw new UserDetailsError('User information is not available');
      }

      setLoadingUserDetails(true);
      setError(null);

      try {
        let data;

        if (ticketingSystem === 'ServiceNow') {
          try {
            // Use backend ServiceNow API
            const response = await serviceDeskInstance.post('/servicenow/get_user', {
              userId: employeeId,
              org_id: user?.org_id || '',
            });
            data = response.data;
          } catch (error) {
            console.error('Error fetching user details for ServiceNow:', error);
            setError(new UserDetailsError('Failed to fetch user details for ServiceNow'));
            throw error;
          }
        } else {
          // Use existing frontend API for other ticketing systems
          try {
            const url = '/api/getNewUserById';
            data = await fetchData(url, 'POST', { userId: employeeId, user });
          } catch (error) {
            console.error('Error fetching user details for other ticketing systems:', error);
            setError(new UserDetailsError('Failed to fetch user details for other ticketing systems'));
            throw error;
          }
          
        }

        if (data.user?.length > 0) {
          const User = data.user[0];
          setUserDetails({
            fullName: `${User.first_name} ${User.last_name}`,
            mobilePhone:
              ticketingSystem === 'ServiceNow' ? User.mobile_phone : User.mobile_phone_number,
            email: ticketingSystem === 'ServiceNow' ? User.email : User.primary_email,
            employeeId,
            employeeNumber:  User?.employee_number || '',
          });
        } else {
          throw new UserDetailsError('User not found');
        }
      } catch (e) {
        console.error(`Error fetching user details for ${ticketingSystem}:`, e);
        setError(
          e instanceof Error
            ? e
            : new UserDetailsError(`Failed to fetch user details for ${ticketingSystem}`),
        );
        throw e;
      } finally {
        setLoadingUserDetails(false);
      }
    },
    [ticketingSystem, user],
  );

  useEffect(() => {
    // Only fetch if employeeId is a valid value (not empty or placeholder)
    if (userDetails.employeeId && userDetails.employeeId !== '-' && userDetails.employeeId.trim() !== '') {
      fetchUserByEmployeeId(userDetails.employeeId).catch((error) => {
        console.error('Error in fetchUserByEmployeeId:', error);
        // Error is already set in the state, so we don't need to do anything else
      });
    }
  }, [fetchUserByEmployeeId, userDetails.employeeId]);

  return {
    userDetails,
    loadingUserDetails,
    setUserDetails,
    fetchUserByEmployeeId,
    error,
  };
};
