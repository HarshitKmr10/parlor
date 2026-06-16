import { useState, useEffect, useCallback } from 'react';
import { API } from 'api';
import { useGlobalContext } from 'contexts/store';
import { ChatAppResponse } from 'api/chat/models';
import { Meeting } from 'types/meetingTypes';
import { PostcallTopics } from 'api/postcallTopcs';
import { PostcallTopic } from 'types/postcallTopicTypes';

interface PostcallDetails {
  meetingDetails: Meeting | null;
  entityData: string;
  sentimentData: string;
  summaryData: string;
  transcriptData: string;
  chatMessages: [string, ChatAppResponse][];
  isLoadingDetails: boolean;
  isLoadingChat: boolean;
  isLoadingMeetingDetails: boolean;
  error: Error | null;
  meetingDetailsError: Error | null;
  postcallTopics: PostcallTopic[];
  isLoadingPostcallTopics: boolean;
  postcallTopicsError: Error | null;
  setPostcallTopics: (topics: PostcallTopic[]) => void;
}

class PostcallDetailsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostcallDetailsError';
  }
}

const usePostcallDetails = (meetingId: string | null): PostcallDetails => {
  const { user } = useGlobalContext();
  const [entityData, setEntityData] = useState<string>('');
  const [sentimentData, setSentimentData] = useState<string>('');
  const [meetingDetails, setMeetingDetails] = useState<Meeting | null>(null);
  const [summaryData, setSummaryData] = useState<string>('');
  const [transcriptData, setTranscriptData] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<[string, ChatAppResponse][]>(
    [],
  );
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const [isLoadingMeetingDetails, setIsLoadingMeetingDetails] = useState<
  boolean
  >(false);
  const [error, setError] = useState<Error | null>(null);
  const [meetingDetailsError, setMeetingDetailsError] = useState<Error | null>(
    null,
  );
  const [postcallTopics, setPostcallTopics] = useState<PostcallTopic[]>([]);
  const [isLoadingPostcallTopics, setIsLoadingPostcallTopics] = useState<boolean>(false);
  const [postcallTopicsError, setPostcallTopicsError] = useState<Error | null>(null);

  const fetchChatMessages = useCallback(async () => {
    if (!meetingId) {
      return;
    }

    setIsLoadingChat(true);
    setError(null);

    try {
      const chatData = await API.Meetings.GetChatMessages(meetingId, user);
      if (
        Array.isArray(chatData)
        && chatData.every((item) => Array.isArray(item) && item.length === 2)
      ) {
        setChatMessages(chatData);
      } else if (chatData === null || chatData === undefined) {
        console.error('No chat data found for the given meeting ID');
        setError(
          new PostcallDetailsError(
            'No chat data found for the given meeting ID',
          ),
        );
      } else {
        console.error('Chat data is in an unexpected format');
        setError(
          new PostcallDetailsError('Chat data is in an unexpected format'),
        );
      }
    } catch (e) {
      console.error('Error fetching chat messages:', e);
      setError(
        new PostcallDetailsError(
          `Failed to fetch chat messages: ${
            e instanceof Error ? e.message : 'Unknown error'
          }`,
        ),
      );
      setChatMessages([]);
    } finally {
      setIsLoadingChat(false);
    }
  }, [meetingId, user]);

  const fetchPostcallTopics = useCallback(async () => {
    if (!meetingId) return;

    setIsLoadingPostcallTopics(true);
    setPostcallTopicsError(null);

    try {
      const topics = await PostcallTopics.getPostcallTopicsForMeeting(meetingId, user);
      setPostcallTopics(topics);
    } catch (e) {
      console.error('Error loading KBs:', e);
      setPostcallTopicsError(
        new PostcallDetailsError('Failed to load KB articles')
      );
      setPostcallTopics([]);
    } finally {
      setIsLoadingPostcallTopics(false);
    }
  }, [meetingId, user]);

  const fetchMeetingDetails = useCallback(async () => {
    if (!meetingId) {
      return;
    }

    setIsLoadingDetails(true);
    setIsLoadingMeetingDetails(true);
    setError(null);
    setMeetingDetailsError(null);

    try {
      const {
        entity,
        sentiment,
        summary,
        transcript,
      } = await API.Meetings.GetPostCall(meetingId, user);

      setEntityData(entity);
      setSentimentData(sentiment);
      setSummaryData(summary);
      setTranscriptData(transcript);

      if (!entity && !sentiment && !summary && !transcript) {
        console.error('No meeting data found for the given meeting ID');
        setError(
          new PostcallDetailsError(
            'No meeting data found for the given meeting ID',
          ),
        );
      }

      try {
        const meetingData = await API.Meetings.GetMeetingsByID(meetingId, user);
        if (!meetingData) {
          throw new PostcallDetailsError('Failed to fetch meeting details');
        }
        setMeetingDetails(meetingData);
      } catch (e) {
        console.error('Error fetching meeting details:', e);
        setMeetingDetailsError(
          new PostcallDetailsError('Failed to fetch meeting details'),
        );
        setMeetingDetails(null);
      }

      await fetchChatMessages();
      await fetchPostcallTopics();
    } catch (e) {
      console.error('Error fetching postcall data:', e);
      setError(new PostcallDetailsError('Failed to fetch postcall data'));
      setEntityData('');
      setSentimentData('');
      setSummaryData('');
      setTranscriptData('');
      setChatMessages([]);
    } finally {
      setIsLoadingDetails(false);
      setIsLoadingMeetingDetails(false);
    }
  }, [meetingId, user, fetchChatMessages, fetchPostcallTopics]);

  useEffect(() => {
    fetchMeetingDetails();
  }, [fetchMeetingDetails]);

  return {
    meetingDetails,
    entityData,
    sentimentData,
    transcriptData,
    summaryData,
    chatMessages,
    isLoadingDetails,
    isLoadingChat,
    isLoadingMeetingDetails,
    error,
    meetingDetailsError,
    postcallTopics,
    setPostcallTopics,
    isLoadingPostcallTopics,
    postcallTopicsError,
  };
};

export default usePostcallDetails;
