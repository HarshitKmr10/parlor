// Importing necessary modules and components

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useGlobalContext } from 'contexts/store';
import Spinner from 'components/spinner/spinner';
import { API } from 'api';
import ChatInterface from './ChatInterface';

function IntakeChat({
  transcript, meetingId, version = 'v1', userDetails, app_id, agentName = ""
}) {
  const { user } = useGlobalContext();
  const [chatMessages, setChatMessages] = useState([]);
  const [loading, setLoading] = useState(true); // Add loading state

  const fetchChatMessages = useCallback(async () => {
    if (!meetingId) return;
    setLoading(true);
    try {
      const parsedMessages = await API.Meetings.GetChatMessages(
        meetingId,
        user,
      );
      setChatMessages(parsedMessages);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchChatMessages();
  }, [fetchChatMessages, meetingId]);

  if (loading) {
    return <Spinner />;
  }

  return (
    <ChatInterface
      chatMessages={chatMessages}
      meetingId={meetingId}
      transcript={transcript}
      version={version}
      userDetails={userDetails}
      app_id={app_id}
      agentName={agentName}
    />
  );
}
export default IntakeChat;
