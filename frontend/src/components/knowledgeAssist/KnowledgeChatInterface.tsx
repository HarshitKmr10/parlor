import React, {
  useEffect, useRef, useState, useCallback,
} from 'react';
import PDFModal from 'components/Modals/PDFModal';
import QuestionAndAnswer from 'components/QuestionAndAnswer/QuestionAndAnswer';
import { QuestionInput } from 'components/QuestionInput';
import { useGlobalContext } from 'contexts/store';
import { ChatAppResponse } from 'api/chat/models';
import { Flex, Box } from '@radix-ui/themes';
import { UserDetails } from 'types/common';
import { useKnowledgePostCallChatApiRequest } from 'hooks/useKnowledgePostCallChatApiRequest';

interface KnowledgeChatInterfaceProps {
  chatMessages: [string, ChatAppResponse][];
  meetingId: string;
  transcript: string;
  showFollowUpQuestions?: boolean;
  userDetails: UserDetails;
  version: string;
  assistantName?: string;
}

function KnowledgeChatInterface({
  chatMessages,
  meetingId,
  transcript,
  showFollowUpQuestions = true,
  userDetails,
  version,
  assistantName
}: KnowledgeChatInterfaceProps) {
  const [answers, setAnswers] = useState<[string, ChatAppResponse][]>(
    chatMessages,
  );
  const { user } = useGlobalContext();
  const { makeApiRequest, isLoading, error } = useKnowledgePostCallChatApiRequest({
    meetingId,
    user,
    transcript,
    userDetails,
    version,
  });

  const [activeCitation, setActiveCitation] = useState<string | undefined>();
  const [showCitation, setShowCitation] = useState(false);

  const lastQuestionRef = useRef<string>('');
  const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

  const handleSendQuestion = useCallback(
    async (question: string) => {
      lastQuestionRef.current = question;
      const result = await makeApiRequest(question, answers);
      if (result) {
        setAnswers((prevAnswers) => [...prevAnswers, result]);
      }
    },
    [makeApiRequest, answers],
  );

  const onShowCitation = useCallback((citation: string) => {
    setShowCitation(true);
    setActiveCitation(citation);
  }, []);

  useEffect(() => {
    chatMessageStreamEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [answers, isLoading]);

  return (
    <Flex direction="column" className="h-full">
      <Flex direction="column" className="flex-grow overflow-y-auto">
        {answers.map((answer, index) => (
          <QuestionAndAnswer
            key={index}
            question={answer[0]}
            answer={answer[1]}
            isLoading={false}
            error={null}
            assistantName={assistantName || "Postcall Assist"}
            onCitationClicked={onShowCitation}
            onRetry={() => {}}
            userName={user?.name}
            profilePic={user?.profile_pic}
          />
        ))}

        {isLoading && (
          <QuestionAndAnswer
            question={lastQuestionRef.current}
            answer={null}
            isLoading
            error={null}
            assistantName={assistantName || "Postcall Assist"}
            onCitationClicked={() => {}}
            onRetry={() => {}}
            userName={user?.name}
            profilePic={user?.profile_pic}
          />
        )}

        {error && (
          <QuestionAndAnswer
            question={lastQuestionRef.current}
            answer={null}
            isLoading={false}
            error={error.message}
            assistantName={assistantName || "Postcall Assist"}
            onCitationClicked={() => {}}
            onRetry={() => handleSendQuestion(lastQuestionRef.current)}
            userName={user?.name}
            profilePic={user?.profile_pic}
          />
        )}
        <div ref={chatMessageStreamEnd} />
      </Flex>
      <Box className="flex-shrink-0">
        <QuestionInput
          clearOnSend
          isLoading={isLoading}
          isStreaming={false}
          showFollowUpQuestions={showFollowUpQuestions}
          onSend={handleSendQuestion}
          followUpQuestions={[]}
          onFollowupQuestionClicked={() => {}}
        />
      </Box>
      {showCitation && !!activeCitation && (
        <div className="_modal z-50">
          <PDFModal
            onClose={() => setShowCitation(false)}
            url={activeCitation}
          />
        </div>
      )}
    </Flex>
  );
}

export default KnowledgeChatInterface;
