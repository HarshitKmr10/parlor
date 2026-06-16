import { useState, useEffect } from 'react';
import { useGlobalContext } from 'contexts/store';
import { API } from 'api';
import { Meeting } from 'types/meetingTypes';

/**
 * Custom hook to fetch and manage P1 meetings
 * @returns {Object} An object containing P1 meetings, loading state, and error information
 */
const useP1Meetings = () => {
  const { user, selectedTeam } = useGlobalContext();
  const [p1Meetings, setP1Meetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchP1Meetings = async () => {
      if (!user || !selectedTeam) {
        setError('User or team not selected');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const p1Data = await API.Teams.GetAllP1IntakeMeetings(
          user,
          selectedTeam,
        );

        if (p1Data.length === 0) {
          setError(`No P1 meetings available for ${selectedTeam.name}`);
          setP1Meetings([]);
          return;
        }

        const meetingIds = p1Data.map((item) => item.meeting_id).join(',');
        const transformedMeetings = await API.Meetings.GetMeetingsByIDs(
          meetingIds,
          user,
        );

        const enhancedMeetings = transformedMeetings.map((meeting) => {
          const p1Info = p1Data.find(
            (p1) => p1.meeting_id === meeting.meeting_id,
          );
          return {
            ...meeting,
            incident_number: p1Info ? p1Info.incident_name : 'N/A',
          };
        });

        setP1Meetings(enhancedMeetings);
      } catch (e) {
        console.error(`Error fetching P1 meetings: ${e.message}`);
        setError(`Error fetching P1 meetings: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchP1Meetings();
  }, [selectedTeam, user]);

  return {
    p1Meetings,
    isLoading,
    error,
  };
};

export default useP1Meetings;
