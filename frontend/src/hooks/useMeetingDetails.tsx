import moment from 'moment';
import { useEffect, useState, useCallback } from 'react';
import { Meeting } from 'types/meetingTypes';
import { API } from 'api';
import { useGlobalContext } from 'contexts/store';

class MeetingDetailsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MeetingDetailsError';
  }
}

const useMeetingDetails = (meetingId: string) => {
  const { user } = useGlobalContext();
  const [meetingDetails, setMeetingDetails] = useState<Meeting | null>(null);
  const [
    meetingDetailsForStatus,
    setMeetingDetailsForStatus,
  ] = useState<Meeting | null>(null);
  const [durationStr, setDurationStr] = useState<string>('Loading...');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMeetingDetails = async () => {
    if (!meetingId || !user) {
      setError(
        new MeetingDetailsError('Missing meetingId or user information'),
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const meetingData = await API.Meetings.GetMeetingsByID(meetingId, user);
      if (!meetingData) {
        setError(new MeetingDetailsError('Failed to fetch meeting details'));
        throw new MeetingDetailsError('Failed to fetch meeting details');
      }

      setMeetingDetails(meetingData);
      setMeetingDetailsForStatus(meetingData);

      let initialDuration;
      if (meetingData?.end_timestamp !== null) {
        initialDuration = moment.duration(
          moment(meetingData?.end_timestamp).diff(
            moment(meetingData.start_timestamp),
          ),
        );
      } else {
        initialDuration = 'In Progress';
      }

      if (moment.isDuration(initialDuration)) {
        setDurationStr(
          `${initialDuration
            .minutes()
            .toString()
            .padStart(2, '0')}:${initialDuration
            .seconds()
            .toString()
            .padStart(2, '0')}`,
        );
      } else {
        setDurationStr('In Progress');
      }
    } catch (err) {
      console.error('Error fetching meeting details:', err);
      setError(
        new MeetingDetailsError(
          `Failed to fetch meeting details: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`,
        ),
      );
      setMeetingDetails(null);
      setDurationStr('Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetingDetails();
  }, [meetingId, user]);

  const fetchStatus = useCallback(async () => {
    if (!meetingId || !user) return;

    try {
      const meetingDataForStatus = await API.Meetings.GetMeetingsByID(
        meetingId,
        user,
      );
      if (!meetingDataForStatus) {
        throw new MeetingDetailsError('Failed to fetch meeting status');
      }
      setMeetingDetailsForStatus(meetingDataForStatus);
    } catch (err) {
      console.error('Error fetching meeting status:', err);
      // We don't set the main error state here to avoid disrupting the UI for status updates
    }
  }, [meetingId, user]);

  useEffect(() => {
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Processing meeting details
  const processedDetails = meetingDetails
    ? {
      startTime: moment(meetingDetails.start_timestamp).format('hh:mm A'),
      startDate: moment(meetingDetails.start_timestamp).format('DD MMM YYYY'),
      endTime: meetingDetails.end_timestamp
        ? moment(meetingDetails.end_timestamp).format('hh:mm A')
        : null,
      formattedLink:
          meetingDetails.channel === 'Phone'
            ? meetingDetails.phone_number
            : 'Copy Meet Link',
      phoneNumber: meetingDetails.phone_number,
      title: meetingDetails.title,
      channel: meetingDetails.channel,
      fullLinkURL: meetingDetails.link,
      listener_id: meetingDetails.listener_id,
    }
    : null;

  const status = meetingDetailsForStatus?.analysis_status || '';

  return {
    ...processedDetails,
    loading,
    durationStr,
    status,
    listenerId: processedDetails?.listener_id,
    error,
    meeting: meetingDetails,
  };
};

export default useMeetingDetails;
