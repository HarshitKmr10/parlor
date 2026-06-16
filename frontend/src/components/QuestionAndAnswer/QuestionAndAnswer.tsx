import React from 'react';
import { Answer, AnswerError, AnswerLoading, IncidentCategoryFormCard, StreamingStatus } from 'components/Answer';
import type { StreamingStage } from 'components/Answer/StreamingStatus';
import { ChatAppResponse } from 'api/chat';
import Question from 'components/Question/Question';
import { Flex, Text } from '@radix-ui/themes';
import { escapeHtml } from 'utils/escapeHtml';
import { CustomAnswerCard } from './CustomAnswerCard';
import { ChatFormCard } from 'components/Answer/ChatFormCard';
import { SuggestedActions } from 'components/chat/SuggestedActions';
import type { SuggestedAction } from 'api/chat/models';

type IncidentCategoryFormData = {
  category: string;
  preferred_contact_method: string;
  contact_information?: string;
  user_email?: string;
};

type QuestionAndAnswerProps = {
  question: string;
  answer: ChatAppResponse | null;
  isLoading: boolean;
  error: string | null;
  onCitationClicked: (citation: string) => void;
  onSubmitIncidentFields?: (formState: Record<string, string>) => Promise<void>;
  onSubmitIncidentCategory?: (formData: IncidentCategoryFormData) => Promise<void>;
  onRetry: () => void;
  assistantName: string;
  userName: string;
  profilePic?: string;
  session_id?: string;
  app_id?: string;
  latestQuickReplies?: string[];
  onSend?: (question: string) => void;
  userSupportGroup?: string;
  useSkeletonLoader?: boolean;
  hideNoContent?: boolean;
  suggestedActions?: SuggestedAction[];
  onActionSelect?: (action: SuggestedAction) => void;
  isActionFlowActive?: boolean;
  /** Whether the response is currently being streamed */
  isStreaming?: boolean;
  /** Status message to show during streaming */
  streamingStatus?: string;
  /** Current streaming stage */
  streamingStage?: StreamingStage;
};

const QuestionAndAnswer = React.memo(function QuestionAndAnswer({
  question: questionUnsanitized,
  answer,
  isLoading,
  error,
  onCitationClicked,
  onSubmitIncidentFields,
  onSubmitIncidentCategory,
  onRetry,
  assistantName,
  userName,
  profilePic,
  session_id,
  app_id,
  latestQuickReplies,
  onSend,
  userSupportGroup,
  useSkeletonLoader = false,
  hideNoContent = false,
  suggestedActions = [],
  onActionSelect,
  isActionFlowActive = false,
  isStreaming = false,
  streamingStatus = '',
  streamingStage,
}: QuestionAndAnswerProps) {
  const question = escapeHtml(questionUnsanitized);

  // Determine content to render
  const renderContent = () => {
    const nudgeIncidentCreation = answer?.data?.response_aids?.nudge_incident_creation;
    const incidentCategories = answer?.data?.response_aids?.incident_categories;

    // Show streaming status indicators for pre-generation stages (before tokens arrive)
    if (isLoading && streamingStage && streamingStage !== 'streaming' && !answer) {
      return (
        <StreamingStatus
          assistantName={assistantName}
          stage={streamingStage}
          message={streamingStatus}
        />
      );
    }

    // Show loading state for non-streaming versions (v1/v2)
    if (isLoading && !isStreaming && !answer) {
      return <AnswerLoading assistantName={assistantName} useSkeletonLoader={useSkeletonLoader} />;
    }

    // Show error state
    if (error) {
      return (
        <AnswerError error={error.toString()} onRetry={onRetry} assistantName={assistantName} />
      );
    }

    // Show incident category form
    if (incidentCategories && incidentCategories.length > 0 && onSubmitIncidentCategory) {
      const botResponseMessage =
        answer?.data?.response_message_content?.assistant ||
        "To proceed with creating your incident ticket, I'll need some essential information. Please provide the following mandatory details:";
      const userEmail = answer?.data?.response_aids?.user_email;

      return (
        <CustomAnswerCard assistantName={assistantName}>
          <Flex direction="column" gap="3">
            <Text size="2" className="text-gray-700">
              {botResponseMessage}
            </Text>
            <IncidentCategoryFormCard
              categories={incidentCategories}
              userEmail={userEmail}
              onSubmit={onSubmitIncidentCategory}
            />
          </Flex>
        </CustomAnswerCard>
      );
    }

    // Show nudge incident creation form
    if (nudgeIncidentCreation?.status && nudgeIncidentCreation?.incident_fields) {
      return (
        <CustomAnswerCard assistantName={assistantName}>
          <ChatFormCard
            formFields={nudgeIncidentCreation.incident_fields}
            onSubmit={onSubmitIncidentFields}
          />
        </CustomAnswerCard>
      );
    }

    // SINGLE Answer component handles both streaming and completed states
    // The same component instance is used throughout - no remounting, no flicker
    if (answer || isStreaming) {
      return (
        <>
          <Answer
            answer={answer}
            isStreaming={isStreaming}
            onCitationClicked={onCitationClicked}
            assistantName={assistantName}
            session_id={session_id}
            app_id={app_id}
            latestQuickReplies={!isStreaming ? latestQuickReplies : undefined}
            onSend={onSend}
            userSupportGroup={userSupportGroup}
          />
          {!isStreaming && suggestedActions?.length > 0 && onActionSelect && !isActionFlowActive && (
            <div className="px-2 md:px-2">
              <SuggestedActions
                actions={suggestedActions}
                onActionSelect={onActionSelect}
                isDisabled={isActionFlowActive}
              />
            </div>
          )}
        </>
      );
    }

    return null;
  };

  return (
    <Flex direction="column" gap="1" className="flex flex-col">
      <Question
        content={question}
        userName={userName}
        profilePic={profilePic}
        hideNoContent={hideNoContent}
      />
      {renderContent()}
    </Flex>
  );
});

export default QuestionAndAnswer;
