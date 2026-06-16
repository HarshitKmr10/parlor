import { useState, useEffect, useCallback, useRef } from 'react';
import { useGlobalContext } from 'contexts/store';
import { API } from 'api';
import { Meeting } from 'types/meetingTypes';

const useMeetingsKnowledgeTransition = () => {
  const { user, selectedTeam } = useGlobalContext();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [localError, setLocalError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const isFetchingRef = useRef(false);

  const LIMIT = 50; // Items per page

  const handleError = (message) => {
    setLocalError(message);
    setIsLoading(false);
    setIsLoadingMore(false);
  };

  const fetchMeetings = useCallback(async (pageNum: number, append = false) => {
    if (isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    
    setError('');
    
    try {
      if (user !== null && selectedTeam !== null) {
        const response = await API.Teams.GetAllKnowledgeTransitionMeetingsPaginated(
          user,
          selectedTeam,
          pageNum,
          LIMIT
        );
        
        if (!response || !response.data) {
          if (!append) {
            handleError(`No meetings available for ${selectedTeam.name}`);
          }
          setHasMore(false);
          return;
        }

        const { data, total_count } = response;
        
        if (data.length === 0) {
          if (!append) {
            handleError(`No meetings available for ${selectedTeam.name}`);
          }
          setHasMore(false);
          return;
        }

        setTotalCount(total_count);
        
        if (append) {
          setMeetings((prev) => [...prev, ...data]);
        } else {
          setMeetings(data);
        }

        // Check if there are more pages
        setHasMore(meetings.length + data.length < total_count);
        
        if (localError) {
          setLocalError(null);
        }
      }
    } catch (e) {
      console.error(`Error fetching meetings: ${e.message}`);
      setError(`Error fetching meetings: ${e.message}`);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [user, selectedTeam, localError, meetings.length]);

  // Initial fetch
  useEffect(() => {
    setMeetings([]);
    setPage(1);
    setHasMore(true);
    fetchMeetings(1, false);
  }, [selectedTeam?.id, user?.access_token]);

  // Load more function
  const loadMore = useCallback(() => {
    if (!isLoadingMore && !isLoading && hasMore && !isFetchingRef.current) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMeetings(nextPage, true);
    }
  }, [isLoadingMore, isLoading, hasMore, page, fetchMeetings]);

  return {
    meetings,
    isLoading,
    isLoadingMore,
    error,
    localError,
    hasMore,
    totalCount,
    loadMore,
  };
};

export default useMeetingsKnowledgeTransition;
