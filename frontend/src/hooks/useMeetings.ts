import { useState, useEffect, useCallback } from 'react';
import { useGlobalContext } from 'contexts/store';
import { API } from 'api';
import { Meeting } from 'types/meetingTypes';

const useMeetings = () => {
  const { user, selectedTeam } = useGlobalContext();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [localError, setLocalError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [currentPageSize, setCurrentPageSize] = useState(0);
  const [limit, setLimit] = useState(10);

  const handleError = (message) => {
    setLocalError(message);
    setIsLoading(false);
  };

  const transformMeetingData = (item: any): Meeting => ({
    id: item.id,
    title: item.title || 'No title',
    start_timestamp: item.start_timestamp,
    analysis_status: item.analysis_status,
    channel: item.channel || 'No channel',
    meeting_id: item.meeting_id,
    end_timestamp: item.end_timestamp,
    app_id: item.app_id,
    bot_name: item.bot_name,
    call_recording_url: item.call_recording_url,
    listener_id: item.listener_id,
    phone_number: item.phone_number,
    postcall_analysis: item.postcall_analysis,
    postcall_analysis_webhook: item.postcall_analysis_webhook,
    postcall_transcript: item.postcall_transcript,
    link: item.link,
  });

  const fetchMeetings = async (cursor?: string, direction: 'forward' | 'backward' | 'initial' = 'initial') => {
    // Check if showCall parameter is present
    const shouldShowCall = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('showCall') === 'true';
    
    if (!shouldShowCall) {
      setMeetings([]);
      setIsLoading(false);
      setIsLoadingMore(false);
      return;
    }

    if (direction === 'forward' || direction === 'backward') {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setMeetings([]);
      setNextCursor(null);
      setHasMore(false);
      setCursorHistory([]);
    }
    
    setError('');
    setLocalError(null);

    try {
      if (user !== null && selectedTeam !== null) {
        const response = await API.Teams.GetAllMeetingsPaginated(
          user,
          selectedTeam,
          limit,
          cursor,
          'created_at',
          'desc'
        );

        if (!response || !response.data) {
          handleError(`No meetings available for ${selectedTeam.name}`);
          return;
        }

        const transformedMeetings = response.data.map(transformMeetingData);

        setMeetings(transformedMeetings);
        setHasMore(response.pagination.has_more);
        setNextCursor(response.pagination.next_cursor);
        setCurrentPageSize(response.pagination.current_page_size);

        if (transformedMeetings.length === 0 && direction === 'initial') {
          handleError(`No meetings available for ${selectedTeam.name}`);
        }
      }
    } catch (e) {
      console.error(`Error fetching meetings: ${e.message}`);
      setError(`Error fetching meetings: ${e.message}`);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadNext = useCallback(() => {
    const shouldShowCall = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('showCall') === 'true';
    if (!shouldShowCall) {
      return;
    }
    
    if (!isLoadingMore && hasMore && nextCursor) {
      // Save current cursor to history before moving forward
      const currentCursor = cursorHistory.length > 0 
        ? cursorHistory[cursorHistory.length - 1] 
        : undefined;
      
      if (currentCursor !== nextCursor) {
        setCursorHistory((prev) => [...prev, nextCursor]);
      }
      
      fetchMeetings(nextCursor, 'forward');
    }
  }, [isLoadingMore, hasMore, nextCursor, cursorHistory]);

  const loadPrevious = useCallback(() => {
    const shouldShowCall = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('showCall') === 'true';
    if (!shouldShowCall) {
      return;
    }
    
    if (!isLoadingMore && cursorHistory.length > 0) {
      // Get the previous cursor from history
      const newHistory = [...cursorHistory];
      newHistory.pop(); // Remove the current cursor
      const previousCursor = newHistory.length > 0 ? newHistory[newHistory.length - 1] : undefined;
      
      setCursorHistory(newHistory);
      fetchMeetings(previousCursor, 'backward');
    }
  }, [isLoadingMore, cursorHistory]);

  const changeLimit = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setCursorHistory([]);
    setNextCursor(null);
  }, []);

  const checkShowCallParam = () => {
    if (typeof window === 'undefined') return false;
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('showCall') === 'true';
  };

  useEffect(() => {
    const shouldShowCall = checkShowCallParam();
    
    if (shouldShowCall) {
      fetchMeetings(undefined, 'initial');
    } else {
      // Reset meetings to empty array if showCall is not true
      setMeetings([]);
      setIsLoading(false);
      setError('');
      setLocalError(null);
      setHasMore(false);
      setNextCursor(null);
      setCursorHistory([]);
      setCurrentPageSize(0);
    }
  }, [selectedTeam, user?.access_token, limit]);

  return {
    meetings,
    isLoading,
    isLoadingMore,
    error,
    localError,
    hasMore,
    hasPrevious: cursorHistory.length > 0,
    loadNext,
    loadPrevious,
    currentPageSize,
    limit,
    changeLimit,
  };
};

export default useMeetings;
