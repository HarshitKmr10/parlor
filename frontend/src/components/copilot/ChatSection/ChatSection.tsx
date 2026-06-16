// Importing necessary modules and components

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from 'contexts/store';
import { useCopilotStore } from 'store/Copilot';
import { useWebSocketStore } from 'store/WebSocket';
import { useUnifiedWebSocketStore } from 'store/UnifiedWebSocket';
import { useOrganizationConfig } from 'hooks/useOrganizationConfig';
import Spinner from 'components/spinner/spinner';
import { API } from 'api';
import ChatInterface from '../ChatInterface';
import FloatingChatWidget from './FloatingChatWidget';

interface ChatSectionProps {
  app_id: string;
  agentName?: string;
  useFloatingWidget?: boolean; // New prop to control widget type
}

function ChatSection({ app_id, agentName = '', useFloatingWidget = false }: ChatSectionProps) {
  const { t } = useTranslation();
  const { user, organization } = useGlobalContext();
  const searchParams = useSearchParams();
  const meetingId = searchParams.get('meetingId');
  const service = searchParams.get('service');
  const isGenesisService = service === 'genesis';

  // Get data from stores
  const userDetails = useCopilotStore((state) => state.userDetails);
  
  // Get transcript from appropriate store based on service type
  const legacyTranscript = useWebSocketStore((state) => state.unformattedWebsocketText);
  const genesisTranscript = useUnifiedWebSocketStore((state) => state.unformattedWebsocketText);
  const unformattedWebsocketText = isGenesisService ? genesisTranscript : legacyTranscript;
  
  const { config } = useOrganizationConfig();


  const [chatMessages, setChatMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchChatMessages = useCallback(async () => {
    if (!meetingId) return;
    setLoading(true);
    try {
      const parsedMessages = await API.Meetings.GetChatMessages(meetingId, user);
      setChatMessages(parsedMessages);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
    } finally {
      setLoading(false);
    }
  }, [meetingId, user]);

  useEffect(() => {
    fetchChatMessages();
  }, [fetchChatMessages]);

  // If using floating widget, return the widget component
  if (useFloatingWidget) {
    return (
      <FloatingChatWidget 
        app_id={app_id} 
        agentName={agentName || t('voice_copilot.aiAssist')}
        chatMessages={chatMessages}
        meetingId={meetingId}
        transcript={unformattedWebsocketText}
        version={config?.version_copilot || 'v1'}
        userDetails={userDetails}
        organization={organization}
      />
    );
  }

  // Default behavior - return the full chat interface
  if (loading) {
    return <Spinner />;
  }

  return (
    <ChatInterface
      chatMessages={chatMessages}
      meetingId={meetingId}
      transcript={unformattedWebsocketText}
      version={config?.version_copilot || 'v1'}
      userDetails={userDetails}
      app_id={app_id}
      agentName={agentName}
      showExampleList={true}
      userName={userDetails?.fullName || 'User'}
    />
  );
}

export default ChatSection;
