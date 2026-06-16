'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Text } from '@radix-ui/themes';
import { chatWidgetStyles } from './ChatWidget.styles';
import ChatBotIcon from '../../icons/ChatBotIcon';
import ChatInterface from '../ChatInterface';
import { useCopilotStore } from 'store/Copilot';

interface FloatingChatWidgetProps {
  app_id: string;
  agentName?: string;
  chatMessages?: any[];
  meetingId?: string;
  transcript?: string;
  version?: string;
  userDetails?: any;
  organization?: any;
}

function FloatingChatWidget({ 
  app_id, 
  agentName = 'AI Assist',
  chatMessages = [],
  meetingId,
  transcript,
  version = 'v1',
  userDetails,
  organization
}: FloatingChatWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [persistentChatMessages, setPersistentChatMessages] = useState(chatMessages);
  
  // Get userDetails from Copilot store
  const storeUserDetails = useCopilotStore((state) => state.userDetails);
  const userName = storeUserDetails?.fullName || userDetails?.fullName || 'User';

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Update persistent chat messages when new chatMessages are passed
  useEffect(() => {
    if (chatMessages && chatMessages.length > 0) {
      setPersistentChatMessages(chatMessages);
    }
  }, [chatMessages]);


  return (
    <div className={chatWidgetStyles.floatingWidget}>
      {/* Floating Chat Widget Button */}
      <motion.div
        className={chatWidgetStyles.widgetButton}
        style={{
          backgroundColor: '#5B5BD6',
          boxShadow: '3.46px 3.46px 16.35px 0px #5B5BD647',
          width: '64px',
          height: '64px',
        }}
        onClick={toggleExpanded}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.5 }}
      >
        <ChatBotIcon className={chatWidgetStyles.widgetIcon} width={28} height={28} />
      </motion.div>

      {/* Floating Chat Window */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className={chatWidgetStyles.floatingWindow}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {/* Header */}
            <div className={chatWidgetStyles.windowHeader}>
              <div className="flex items-center gap-2">
                <div className={chatWidgetStyles.headerIcon}>
                  <ChatBotIcon width={32} height={32} />
                </div>
                <Text className={chatWidgetStyles.headerText}>{agentName}</Text>
              </div>
              <button 
                className={chatWidgetStyles.closeButton}
                onClick={toggleExpanded}
              >
                <svg className={chatWidgetStyles.closeIcon} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>

            {/* Chat Interface */}
            <div style={{ height: '35.5rem'}} className="flex-1 absolute bottom-0 ">
              <ChatInterface
                chatMessages={persistentChatMessages}
                meetingId={meetingId}
                transcript={transcript}
                version={version}
                userDetails={userDetails}
                app_id={app_id}
                agentName={agentName}
                userName={userName}
                showExampleList={true}
                onChatUpdate={(newMessages) => setPersistentChatMessages(newMessages)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FloatingChatWidget;
