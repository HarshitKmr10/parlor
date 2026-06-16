import React from 'react';
import Spinner from 'components/spinner/spinner';
import { ChatAppResponse } from 'api/chat/models';
import { UserDetails } from 'types/common';
import ChatInterface from './ChatInterface';

interface PostCallChatProps {
  chatMessages: [string, ChatAppResponse][];
  meetingId: string;
  transcriptData: string;
  loading: boolean;
  userDetails: UserDetails;
  version: string;
  app_id: string;
  agentName?: string;
}

function PostCallChat({
  chatMessages,
  meetingId,
  transcriptData,
  loading,
  userDetails,
  version,
  app_id,
  agentName
}: PostCallChatProps) {
  if (loading) {
    return (
      <Spinner />
    );
  }
  return (
    <ChatInterface
      chatMessages={chatMessages}
      meetingId={meetingId}
      transcript={transcriptData}
      showFollowUpQuestions={false}
      userDetails={userDetails}
      version={version}
      app_id={app_id}
      agentName={agentName}
    />
  );
}

export default PostCallChat;
