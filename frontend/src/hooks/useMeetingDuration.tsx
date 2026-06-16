import {
  useState, useEffect, useCallback, useRef,
} from 'react';

const useMeetingDuration = (meetingData, status) => {
  const [duration, setDuration] = useState('00:00');
  const timerRef = useRef(null);

  useEffect(() => {
    const calculateDuration = () => {
      if (status === null || status === 'loading' || status === '') {
        setDuration('-:--');
        return;
      }

      if (!meetingData || !meetingData.start_timestamp) {
        setDuration('00:00');
        return;
      }

      const startTime = new Date(meetingData.start_timestamp);
      const endTime = ['analysis_done', 'meeting_ended', 'transcript_processing'].includes(
        status,
      ) && meetingData.end_timestamp
        ? new Date(meetingData.end_timestamp)
        : new Date();

      const durationInSeconds = Math.max(
        0,
        Math.floor((endTime.getTime() - startTime.getTime()) / 1000),
      );
      
      const days = Math.floor(durationInSeconds / (24 * 3600));
      const hours = Math.floor((durationInSeconds % (24 * 3600)) / 3600);
      const minutes = Math.floor((durationInSeconds % 3600) / 60);
      const seconds = durationInSeconds % 60;
      
      let formattedDuration = '';
      
      if (days > 0) {
        // Format: dd:hh:mm:ss
        formattedDuration = `${days.toString().padStart(2, '0')}:${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else if (hours > 0) {
        // Format: hh:mm:ss
        formattedDuration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else {
        // Format: mm:ss
        formattedDuration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      
      setDuration(formattedDuration);
    };

    calculateDuration();

    if (
      status !== null
      && !['analysis_done', 'meeting_ended', 'transcript_processing'].includes(
        status,
      )
    ) {
      timerRef.current = setInterval(calculateDuration, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [meetingData, status]);

  return duration;
};

export default useMeetingDuration;
