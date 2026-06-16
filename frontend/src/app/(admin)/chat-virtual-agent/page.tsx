'use client';

import { Flex, Box, Text, Spinner } from '@radix-ui/themes';
import { API } from 'api';
import { ChatVirtualConversation } from 'api/chatVirtualAgent';
import ChatVirtualList from 'components/chatvirtualagent/ChatVirtualList';
import NoDataIcon from 'components/icons/NoDataIcon';
import { useGlobalContext } from 'contexts/store';
import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useRef } from 'react';
import withAuth from 'components/withAuth';
import ChatVirtualPage from './ChatVirtualPage';
import { useWebSocketToken } from 'hooks/useWebSocketToken';

function SelectConversationScreen() {
  const { t } = useTranslation();
  return (
    <Box className="h-full px-2">
      <Flex direction="column" gapY="2" height="100%" justify="center" align="center">
        <NoDataIcon />
        <Text size="1" align="center" className="text-balance text-gray-700">
          {t('chat_virtual_agent.pleaseSelectConversation')}
        </Text>
      </Flex>
    </Box>
  );
}

function ChatVirtualAgent() {
  const { t } = useTranslation();
  const { user, organization } = useGlobalContext();
  const [conversations, setConversations] = useState<ChatVirtualConversation[]>([]);
  const selectedConversationRef = useRef<ChatVirtualConversation | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ChatVirtualConversation | null>(
    null,
  );
  const [websocketText, setWebsocketText] = useState([]);
  const [websocket, setWebsocket] = useState(null);
  const [interactionDetails, setInteractionDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInteractionLoading, setIsInteractionLoading] = useState(false);
  const { token } = useWebSocketToken();

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setIsLoading(true);
        const fetchedConversations = await API.ChatVirtualCalls.GetConversations(
          user?.org_id
        );
        setConversations(fetchedConversations);

        if (selectedConversationRef.current) {
          const updatedConversation = fetchedConversations.find(
            (conversation) => conversation.id === selectedConversationRef.current?.id,
          );

          if (
            updatedConversation &&
            JSON.stringify(selectedConversationRef.current) !== JSON.stringify(updatedConversation)
          ) {
            selectedConversationRef.current = updatedConversation;
            setSelectedConversation(updatedConversation);
          }
        }
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();
    const interval = setInterval(fetchConversations, 20000);

    return () => clearInterval(interval);
  }, []);

  const handleSelectConversation = (conversation: ChatVirtualConversation) => {
    setSelectedConversation(conversation);
    selectedConversationRef.current = conversation;
  };

  const handleWebsocketMessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Data', data);
      setWebsocketText(data);
    } catch (error) {
      console.error('Error handling websocket message:', error);
    }
  };

  const COPILOT_SERVER_WS_URL = `${process.env.NEXT_PUBLIC_FRONTEND_IP}`;

  // Handle WebSocket connection
  useEffect(() => {
    const setupWebSocket = async () => {
      try {
        if (selectedConversation?.status === 'ongoing' && token) {
          const wsUri = `${COPILOT_SERVER_WS_URL}/service_desk/${selectedConversation.id}/real_time_chat_transcript?token=${token}&user_id=${user.id}`;

          // Reset current state
          setWebsocketText([]);
          if (websocket) {
            websocket.close();
            setWebsocket(null);
          }

          // Setup new websocket
          const newWebsocket = new WebSocket(wsUri);
          newWebsocket.onmessage = handleWebsocketMessage;
          newWebsocket.onerror = (error) => {
            console.error('WebSocket Error:', error);
          };
          newWebsocket.onopen = () => {
            console.log('WebSocket connected:', wsUri);
          };

          setWebsocket(newWebsocket);
        } else if (selectedConversation) {
          // Handle non-ongoing conversations
          setWebsocketText([]);
          if (websocket) {
            websocket.close();
            setWebsocket(null);
          }

          console.log(
            'Selected Conversation messages when not ongoing',
            selectedConversation.messages,
          );
          setWebsocketText(selectedConversation.messages || []);
        }
      } catch (error) {
        console.error('Error setting up WebSocket:', error);
      }
    };

    setupWebSocket();

    return () => {
      if (websocket) {
        websocket.close();
        setWebsocketText([]);
      }
    };
  }, [selectedConversation, token, user]);
  useEffect(() => {
    const fetchInteractionDetails = async () => {
      if (!selectedConversation?.interaction_id || !user) return;

      try {
        setIsInteractionLoading(true);
        const response = await fetch('/api/interactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            interactionId: selectedConversation.interaction_id,
            user,
          }),
        });

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Interaction Details:', data.interaction);
        setInteractionDetails(data.interaction);
      } catch (error) {
        console.error('Failed to fetch interaction details:', error);
      } finally {
        setIsInteractionLoading(false);
      }
    };

    fetchInteractionDetails();
  }, [selectedConversation?.interaction_id, user]);
  const moduleName =
    JSON.parse(organization?.config || '{}')?.Modules?.chat_virtual_agent?.name ??
    t('chat_virtual_agent.chatVirtualAgent');

  return (
    <Flex direction="column" className="h-full">
      <Box className="flex-shrink-0">
        <Flex
          align="center"
          justify="between"
          className="h-14 border-b border-[var(--gray-8)]"
          px="4"
        >
          <Text size="4" weight="medium">
            {moduleName}
          </Text>
        </Flex>
      </Box>
      <Flex className="flex-grow overflow-hidden">
        <Box className="w-1/4">
          <ChatVirtualList conversations={conversations} onSelect={handleSelectConversation} />
        </Box>
        <Box className="w-3/4 flex-grow overflow-hidden">
          {selectedConversation === null ? (
            <SelectConversationScreen />
          ) : (
            <ChatVirtualPage
              selectedConversation={selectedConversation}
              websocketText={websocketText}
              interactionDetails={interactionDetails}
              isInteractionLoading={isInteractionLoading}
            />
          )}
        </Box>
      </Flex>
    </Flex>
  );
}

export default withAuth(ChatVirtualAgent);
