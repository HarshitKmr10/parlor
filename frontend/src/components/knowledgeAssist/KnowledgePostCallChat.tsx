import React from 'react';
import Spinner from 'components/spinner/spinner';
import { ChatAppResponse } from 'api/chat/models';
import { UserDetails } from 'types/common';
import KnowledgeChatInterface from './KnowledgeChatInterface';

interface PostCallChatProps {
  chatMessages: [string, ChatAppResponse][];
  meetingId: string;
  transcriptData: string;
  loading: boolean;
  userDetails: UserDetails;
  version: string;
  assistantName?: string;
}

function PostCallChat({
  chatMessages,
  meetingId,
  transcriptData,
  loading,
  userDetails,
  version,
  assistantName
}: PostCallChatProps) {
  if (loading) {
    return (
      <Spinner />
    );
  }
  return (
    <KnowledgeChatInterface
      chatMessages={chatMessages}
      meetingId={meetingId}
      transcript={transcriptData}
      showFollowUpQuestions={false}
      userDetails={userDetails}
      version={version}
      assistantName={assistantName}
    />
  );
}

export default PostCallChat;
