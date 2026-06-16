import { useState, useEffect, useCallback } from 'react';
import { useGlobalContext } from 'contexts/store';
import { API } from 'api';
import { Meeting } from 'types/meetingTypes';

const useP1MeetingDetails = (meetingId: string) => {
  const { user } = useGlobalContext();
  const [p1Meeting, setP1Meeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchP1MeetingDetails = useCallback(async () => {
    if (!meetingId) {
      setError('Meeting ID is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const meetingData = await API.Meetings.GetMeetingsByID(meetingId, user);

      if (!meetingData || typeof meetingData !== 'object') {
        throw new Error('Invalid P1 meeting data received');
      }

      setP1Meeting(meetingData);
    } catch (e) {
      console.error('Error fetching P1 meeting details:', e);
      setError(e instanceof Error ? e.message : 'Failed to fetch P1 meeting details');
      setP1Meeting(null);
    } finally {
      setIsLoading(false);
    }
  }, [meetingId, user]);

  useEffect(() => {
    fetchP1MeetingDetails();
  }, [fetchP1MeetingDetails]);

  return {
    p1Meeting,
    isLoading,
    error,
  };
};

export default useP1MeetingDetails;
