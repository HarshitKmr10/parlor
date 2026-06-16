'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Flex, Box } from '@radix-ui/themes';
import PDFModal from 'components/Modals/PDFModal';
import { API } from 'api';
import { useGlobalContext } from 'contexts/store';
import { ChatAppResponse, ResponseMessage } from 'api/chat/models';
import { chatCopilotAssistApi } from 'services/VoiceCopilot/api';
import QuestionAndAnswer from 'components/QuestionAndAnswer/QuestionAndAnswer';
import { QuestionInput } from 'components/QuestionInput';
import ChatExampleList from './ChatSection/ChatExampleList';

interface ChatInterfaceProps {
  chatMessages: any;
  meetingId: any;
  transcript: any;
  version?: string;
  userDetails: any;
  app_id: any;
  agentName?: string;
  userName?: string;
  showExampleList?: boolean;
  onChatUpdate?: (messages: any) => void;
}

function ChatInterface({ chatMessages, meetingId, transcript, version = 'v1', userDetails ,app_id, agentName = "", userName = "User", showExampleList = false, onChatUpdate }: ChatInterfaceProps) {
  const [answers, setAnswers] = useState<[user: string, response: ChatAppResponse][]>(
    chatMessages || [],
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<unknown>();
  const { user } = useGlobalContext();

  const [activeCitation, setActiveCitation] = useState<string>();
  const [showCitation, setShowCitation] = useState(false);

  const lastQuestionRef = useRef<string>('');

  const saveChatMessage = async (message: string, role: string, meetingID: string, messageId: string) => {
    try {
      await API.Meetings.InsertChatMessage(meetingID, message, role, messageId, user);
    } catch (e) {
      console.error('Error saving chat message');
    }
  };

  const reformatTranscript = (htmlString) => {
    const div = document.createElement('div');
    div.innerHTML = htmlString;
    const strongTags = div.querySelectorAll('strong');

    let formattedText = '';
    strongTags.forEach((tag) => {
      let text = '';
      let nextElement = tag.nextSibling;
      while (nextElement && nextElement.nodeName !== 'STRONG') {
        text += `${nextElement.textContent.trim()} `;
        nextElement = nextElement.nextSibling;
      }
      formattedText += `Speaker: ${text.trim()}\n\n`;
    });
    return formattedText;
  };

  const makeApiRequest = async (question: string) => {
    lastQuestionRef.current = question;

    if (error) setError(undefined);
    setIsLoading(true);
    setActiveCitation(undefined);
    setShowCitation(false);

    try {
      const messages: ResponseMessage[] = answers.flatMap((a) => [
        { content: a[0], role: 'user' },
        { content: a[1].data.response_message_content.assistant, role: 'assistant' },
      ]);

      const response = await chatCopilotAssistApi(
        messages,
        question,
        transcript,
        meetingId,
        user?.org_id,
        reformatTranscript,
        userDetails,
        version,
      );
      const newAnswers: [user: string, response: ChatAppResponse][] = [...answers, [question, response]];
      setAnswers(newAnswers);
      
      // Update parent component with new chat messages
      if (onChatUpdate) {
        onChatUpdate(newAnswers as any);
      }

      saveChatMessage(
        JSON.stringify([
          question,
          {
            data: {
              response_message_content: {
                assistant: response.data.response_message_content.assistant,
              },
              response_aids: {
                citations: response.data.response_aids.citations,
                follow_up_questions: [],
              },
            },
          },
        ]),
        'assistant',
        meetingId,
        response.data.response_aids.message_id
      );
    } catch (e) {
      console.error('Error making API request:', e);
      setError(e);
    } finally {
      setIsLoading(false);
    }
  };

  const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

  const onShowCitation = (citation: string) => {
    setShowCitation(false);
    setShowCitation(true);
    setActiveCitation(citation);
  };

  const onExampleClicked = (example: string) => {
    makeApiRequest(example);
  };

  useEffect(() => {
    chatMessageStreamEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isLoading]);

  // Update answers when chatMessages prop changes
  useEffect(() => {
    if (chatMessages && chatMessages.length > 0) {
      setAnswers(chatMessages as [user: string, response: ChatAppResponse][]);
    }
  }, [chatMessages]);

  const renderChatContent = () => {
    if (answers.length === 0 && !lastQuestionRef.current && !chatMessages?.length && showExampleList) {
      return <ChatExampleList onExampleClicked={onExampleClicked} userName={userName} />;
    }

    return (
      <Flex direction="column" className="h-full w-full overflow-auto">
        {answers.map((answer, index) => (
          <QuestionAndAnswer
            key={index}
            question={answer[0]}
            answer={answer[1]}
            isLoading={false}
            error={null}
            assistantName={agentName || "Co-Resolve Assist"}
            onCitationClicked={(c) => onShowCitation(c)}
            onRetry={() => {}}
            userName={user?.name}
            profilePic={user?.profile_pic}
            session_id={meetingId}
            app_id={app_id}
          />
        ))}

        {isLoading && (
          <QuestionAndAnswer
            question={lastQuestionRef.current}
            answer={null}
            isLoading
            error={null}
            assistantName={agentName || "Co-Resolve Assist"}
            onCitationClicked={() => {}}
            onRetry={() => {}}
            userName={user?.name}
            profilePic={user?.profile_pic}
            session_id={meetingId}
            app_id={app_id}
          />
        )}

        {error && (
          <QuestionAndAnswer
            question={lastQuestionRef.current}
            answer={null}
            isLoading={false}
            error={error.toString()}
            assistantName={agentName || "Co-Resolve Assist"}
            onCitationClicked={() => {}}
            onRetry={() => makeApiRequest(lastQuestionRef.current)}
            userName={user?.name}
            profilePic={user?.profile_pic}
            session_id={meetingId}
            app_id={app_id}
          />
        )}
        <div ref={chatMessageStreamEnd} />
      </Flex>
    );
  };

  return (
    <Flex direction="column" className="h-full">
      <Flex direction="column" className="flex-grow overflow-y-auto">
        {renderChatContent()}
      </Flex>
      <Box className="flex-shrink-0">
        <QuestionInput
          clearOnSend
          isLoading={isLoading}
          isStreaming={false}
          onSend={(question) => makeApiRequest(question)}
          followUpQuestions={[]}
          onFollowupQuestionClicked={() => {}}
        />
      </Box>
      {showCitation && !!activeCitation && (
        <div className="_modal z-50">
          <PDFModal onClose={() => setShowCitation(false)} url={activeCitation} />
        </div>
      )}
    </Flex>
  );
}

export default ChatInterface;
