'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  TrainAssistTopic,
  trainAssistChatV2,
  SessionVariables,
  TrainAssistChatResponse
} from '../../../../api/trainAssist';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Flex, Box, Text, Avatar, Button, IconButton } from '@radix-ui/themes';
import { ArrowRightIcon, Cross2Icon } from '@radix-ui/react-icons';
import AIChatIcon from 'components/icons/AIChatIcon';
import { useGlobalContext } from 'contexts/store';
import { sendSimulationMessage, concludeSimulationSession } from '@/api/trainAssistV2/api';
import { useTranslation } from 'react-i18next';

const STOP_PHRASES = ["end simulation",  "stop simulation", "stop", "cancel"]; // Hard

const clientName = process.env.NEXT_PUBLIC_CLIENT;

interface ChatAssistProps {
  view: 'topic' | 'quiz-intro' | 'quiz' | 'quiz-results' | 'simulation';
  topic: TrainAssistTopic | null;
  currentModule: number;
  chatInput: string;
  setChatInput: (value: string) => void;
  onRefresh?: () => void;
  className?: string;
  isDisabled?: boolean;
  simulationSessionId?: string | null;
  initialSimMessage?: string | null;
  quizResults?: {
    score: number;
    correct_count: number;
    total_questions: number;
    feedback: Array<{
      question_index: number;
      is_correct: boolean;
      correct_answer: number;
      explanation: string;
    }>;
    
  } | null;
  showEndChat?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  quickReplies?: string[];
}

// Memoized markdown components config to avoid recreation on each render
const markdownComponents = {
  h1: ({ children }: { children: React.ReactNode }) => (
    <h1 className="text-2xl font-bold mt-6 mb-1">{children}</h1>
  ),
  h2: ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-xl font-bold mt-5 mb-1">{children}</h2>
  ),
  h3: ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-lg font-bold mt-4 mb-1">{children}</h3>
  ),
  h4: ({ children }: { children: React.ReactNode }) => (
    <h4 className="text-base font-bold mt-3 mb-1">{children}</h4>
  ),
  h5: ({ children }: { children: React.ReactNode }) => (
    <h5 className="text-sm font-bold mt-2 mb-1">{children}</h5>
  ),
  h6: ({ children }: { children: React.ReactNode }) => (
    <h6 className="text-xs font-bold mt-2 mb-1">{children}</h6>
  ),
  p: ({ children }: { children: React.ReactNode }) => <p className="mb-1">{children}</p>,
  strong: ({ children }: { children: React.ReactNode }) => (
    <strong className="font-bold">{children}</strong>
  ),
  em: ({ children }: { children: React.ReactNode }) => <em className="italic">{children}</em>,
  code: ({ inline, className, children }: { inline?: boolean; className?: string; children: React.ReactNode }) => (inline ? (
    <code className="bg-[var(--accent-3)] px-1 py-0.5 rounded text-xs font-mono">
      {children}
    </code>
  ) : (
    <code
      className={`block bg-[var(--accent-3)] p-3 rounded-lg mb-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words ${className}`}
    >
      {children}
    </code>
  )),
  pre: ({ children }: { children: React.ReactNode }) => (
    <pre className="bg-[var(--accent-3)] p-3 rounded-lg mb-1 overflow-x-auto text-xs">
      {children}
    </pre>
  ),
  ul: ({ children }: { children: React.ReactNode }) => (
    <ul className="list-disc pl-5 mb-1">{children}</ul>
  ),
  ol: ({ children }: { children: React.ReactNode }) => (
    <ol className="list-decimal pl-5 mb-1">{children}</ol>
  ),
  li: ({ children }: { children: React.ReactNode }) => <li className="mb-1">{children}</li>,
  blockquote: ({ children }: { children: React.ReactNode }) => (
    <blockquote className="border-l-4 border-[var(--accent-6)] pl-4 italic my-1">
      {children}
    </blockquote>
  ),
  a: ({ href, children }: { href?: string; children: React.ReactNode }) => (
    <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

// Markdown Text component for consistent rendering - memoized to prevent re-renders
const MarkDownText = memo(function MarkDownText({ value }: { value: string }) {
  return (
    <div className="text-sm leading-relaxed text-gray-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
});

// Question component for user messages - memoized
const Question = memo(function Question({ content }: { content: string }) {
  const { user } = useGlobalContext();
  const { t } = useTranslation();

  return (
    <Box className="bg-[var(--accent-3)] p-2 rounded-md mb-2">
      <Flex gap="2">
        <Avatar
          size="2"
          fallback={`${user?.name?.charAt(0)}` || "U"}
          radius="medium"
          variant="solid"
        />
        <Flex direction="column" minWidth="0">
          <Text size="2" weight="bold" style={{ color: 'var(--pink-9)' }}>
            {t('trainAssist.you')}
          </Text>
          <MarkDownText value={content} />
        </Flex>
      </Flex>
    </Box>
  );
});

// Answer component for assistant messages - memoized
const Answer = memo(function Answer({ content, quickReplies, onQuickReplyClick, view }: {
  content: string,
  quickReplies?: string[],
  onQuickReplyClick?: (reply: string) => void
  view: string;
}) {
  const { t } = useTranslation();
  const clientName = process.env.NEXT_PUBLIC_CLIENT;

  return (
    <Box className="p-2 mb-4 border-b border-[var(--accent-3)]">
      <Flex gap="2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center relative ml-[-2px]">
          <AIChatIcon className={'!w-8 !h-8  ml-[2.6px]'}/>
        </div>
        <Flex direction="column" width="100%">
          <Text size="2" weight="bold" style={{ color: 'var(--pink-9)' }}>
            {view === 'simulation'
              ? t('trainAssist.sophiaAI')
              : clientName === 'PROFILE_GD'
                ? t('trainAssist.trainingAssistAI')
                : t('trainAssist.trainAssistName')}
          </Text>
          <MarkDownText value={content} />

          {quickReplies && quickReplies.length > 0 && (
            <Flex wrap="wrap" gap="2" className="mt-2">
              {quickReplies.map((reply, index) => (
                <Button
                  key={index}
                  size="1"
                  variant="soft"
                  onClick={() => onQuickReplyClick && onQuickReplyClick(reply)}
                  className="text-sm"
                >
                  {reply}
                </Button>
              ))}
            </Flex>
          )}
        </Flex>
      </Flex>
    </Box>
  );
});

export default function ChatAssist({
  view,
  topic,
  currentModule,
  quizResults,
  chatInput: parentChatInput,
  setChatInput: setParentChatInput,
  className,
  isDisabled,
  onRefresh,
  initialSimMessage,
  simulationSessionId,
  showEndChat
}: ChatAssistProps) {
  const { t } = useTranslation();
  // State to store chat messages

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>(uuidv4());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Local state for input to prevent rerenders
  const [localInput, setLocalInput] = useState<string>(parentChatInput || '');

  const [isConcluded, setIsConcluded] = useState(false);

  // Session variables for the API call
  const sessionVariables: SessionVariables = {
    session_id: sessionId,
    org_id: topic?.org_id || 'default-org',
    app_id: 'train-assist',
    return_context: false
  };

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (view === 'simulation' && initialSimMessage && simulationSessionId && messages.length === 0) {
      setMessages([
        {
          id: uuidv4(),
          role: 'assistant',
          content: initialSimMessage,
          timestamp: new Date(),
        },
      ]);
    }
  }, [view, initialSimMessage, simulationSessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chat with welcome message
  useEffect(() => {
    const welcomeMessage: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: `${getWelcomeMessage()}\n\n${getFollowUpMessage()}`,
      timestamp: new Date(),
      quickReplies: [getQuickQuestion1(), getQuickQuestion2()]
    };
    // setMessages([welcomeMessage])
  }, [view, topic, currentModule, quizResults]);

  // Process API response - memoized (declared before handleSendMessage which uses it)
  const handleApiResponse = useCallback((response: TrainAssistChatResponse) => {
    if (response.error !== null) {
      console.error('API Error:', response.error);
      return;
    }

    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: response.data.response_message_content.assistant,
      timestamp: new Date(),
      quickReplies: response.data.response_aids.quick_replies ||
        response.data.response_aids.follow_up_questions
    };

    setMessages(prev => [...prev, assistantMessage]);
  }, []);

  // Handle sending a message - memoized to prevent child re-renders
  const handleSendMessage = useCallback(async (suggestedText?: string) => {
  if ((!suggestedText && !localInput.trim()) || !topic) return;
  const userContent = suggestedText ? suggestedText : localInput;

  const userMessage: ChatMessage = {
    id: uuidv4(),
    role: 'user',
    content: userContent,
    timestamp: new Date(),
  };

  if (view === 'simulation' && simulationSessionId) {
    try {
      setMessages((prev) => [...prev, userMessage]);
      setParentChatInput('');
      setLocalInput('');
      setIsLoading(true);

      const response = await sendSimulationMessage(simulationSessionId, userContent);

      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: response.customer_response,
        timestamp: new Date(),
      };
      const stopTriggered = STOP_PHRASES.some((phrase) => userContent.toLowerCase().includes(phrase));
      if (!stopTriggered) {
        setMessages((prev) => [...prev, assistantMessage]);
      }
      
      if (response.is_resolved || response.timed_out || response.should_conversation_end || stopTriggered) {
        const result = await concludeSimulationSession(simulationSessionId);
        setIsConcluded(true);

        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            role: 'assistant',
            content: `✅ ${t('trainAssist.thankYouSimulationEnded')}`,
            timestamp: new Date(),
          },
          {
            id: uuidv4(),
            role: 'assistant',
            content: `📋 **${t('trainAssist.agentFeedback')}**: ${result?.agent_feedback || ""}`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error('Simulation error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: 'assistant',
          content: t('trainAssist.simulationError'),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
    return;
  }


    setMessages(prev => [...prev, userMessage]);
    // Update parent state to empty string instead of the current input
    setParentChatInput('');
    setLocalInput('');
    setIsLoading(true);

    try {
      // Format messages for API
      const apiMessages = messages.concat(userMessage).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Call the trainAssistChatV2 API
      const response = await trainAssistChatV2(
        apiMessages,
        sessionVariables,
        topic.id
      );

      // Process response
      handleApiResponse(response);
    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: 'assistant',
        content: t('trainAssist.errorProcessingRequest'),
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [localInput, topic, view, simulationSessionId, messages, sessionId, handleApiResponse, t]);

  // Handle quick reply button click - memoized
  const handleQuickReply = useCallback((replyText: string) => {
    if (isDisabled) return;
    handleSendMessage(replyText);
  }, [isDisabled, handleSendMessage]);

  // Generate appropriate messages based on the current view
  const getWelcomeMessage = () => {
    switch (view) {
      case 'topic':
        return t('trainAssist.welcomeToLearningModule', { title: topic?.title || 'Password Reset' });
      case 'quiz-intro':
        return t('trainAssist.readyToTestKnowledge');
      case 'quiz-results':
        return t('trainAssist.greatJobCompletingQuiz', { 
          correct: quizResults?.correct_count || 5, 
          total: quizResults?.total_questions || 8 
        });
      case 'quiz':
        return t('trainAssist.greatJobWorkingThroughQuiz');
    }
  };

  const getFollowUpMessage = () => {
    switch (view) {
      case 'topic':
        return t('trainAssist.letsStartWithStep', { 
          step: currentModule + 1, 
          title: topic?.details?.modules?.[currentModule]?.title || 'Verifying the user\'s identity' 
        });
      case 'quiz-intro':
        return t('trainAssist.feelFreeToAskQuestions');
      case 'quiz-results':
        return t('trainAssist.wouldLikeToReview');
      case 'quiz':
        return t('trainAssist.takeYourTime');
    }
  };

  const getQuickQuestion1 = () => {
    switch (view) {
      case 'topic':
        return t('trainAssist.yesPlease');
      case 'quiz-intro':
        return t('trainAssist.whatTopicsCovered');
      case 'quiz-results':
        return t('trainAssist.explainQuestion', { number: 3 });
      case 'quiz':
        return t('trainAssist.howShouldIVerify');
    }
  };

  const getQuickQuestion2 = () => {
    switch (view) {
      case 'topic':
        return t('trainAssist.whatIfUserSaysImportant');
      case 'quiz-intro':
        return t('trainAssist.howIsQuizScored');
      case 'quiz-results':
        return t('trainAssist.whereCanIPracticeMore');
      case 'quiz':
        return t('trainAssist.whatsPolicyOnFailedChecks');
    }
  };

  const refresh =  useCallback(() => {
    setIsLoading(true);
    if (onRefresh) {
      console.log("onRefresh", onRefresh);
      setMessages([]);
      setSessionId(uuidv4());
      setLocalInput('');  
      onRefresh();
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
      
    } else {
      window.location.reload();
    }
  }, []);

  const handleEndChat = useCallback(async () => {
    if (view === 'simulation' && simulationSessionId && !isConcluded) {
      try {
        setIsLoading(true);
        
        // Send a stop message without displaying it
        await sendSimulationMessage(simulationSessionId, 'stop');
        
        const result = await concludeSimulationSession(simulationSessionId);
        setIsConcluded(true);

        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            role: 'assistant',
            content: `✅ ${t('trainAssist.chatSessionEndedByUser')}`,
            timestamp: new Date(),
          },
          {
            id: uuidv4(),
            role: 'assistant',
            content: `📋 **${t('trainAssist.agentFeedback')}**: ${result?.agent_feedback || t('trainAssist.noFeedbackAvailable')}`,
            timestamp: new Date(),
          },
        ]);
      } catch (error) {
        console.error('Error ending simulation:', error);
        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            role: 'assistant',
            content: t('trainAssist.chatSessionEnded'),
            timestamp: new Date(),
          },
        ]);
        setIsConcluded(true);
      } finally {
        setIsLoading(false);
      }
    } else {
      // For non-simulation views, just add an end message
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: 'assistant',
          content: `✅ ${t('trainAssist.chatSessionEndedThankYou')}`,
          timestamp: new Date(),
        },
      ]);
      setIsConcluded(true);
    }
  }, [view, simulationSessionId, isConcluded, t]);

  return (
    <Flex
      direction="column"
      className={`h-full w-full overflow-hidden rounded-lg bg-white shadow ${className || ''}`}
    >
      <Box className="border-b px-4 py-3">
        <Flex justify="between" align="center">
          <Text weight="medium">{view === 'simulation' ? t('trainAssist.aiSimulation') : t('trainAssist.aiAssist')}</Text>
          <Flex gap="2">
            {showEndChat && (
              <Button
                variant="outline"
                size="1"
                onClick={handleEndChat}
                disabled={isConcluded || isLoading}
                color="red"
              >
                {t('trainAssist.endChat')}
              </Button>
            )}
            <Button variant="outline" size="1" onClick={refresh}>
              {t('trainAssist.refresh')}
            </Button>
          </Flex>
        </Flex>
      </Box>

      {/* Chat Messages */}
      <Box className="flex-grow overflow-y-auto p-4">
        <Flex direction="column" gap="2">
          {messages.map((message) =>
            message.role === 'user' ? (
              <Question key={message.id} content={message.content} />
            ) : (
              <Answer
                key={message.id}
                content={message.content}
                onQuickReplyClick={handleQuickReply}
                view={view}
              />
            ),
          )}

          {/* Loading indicator */}
          {isLoading && (
            <Flex justify="center" className="my-4">
              <div className="flex animate-pulse space-x-2">
                <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                <div className="h-2 w-2 rounded-full bg-gray-400"></div>
              </div>
            </Flex>
          )}

          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} />
        </Flex>
      </Box>

      {/* Suggestion */}
      {messages[messages?.length - 1]?.quickReplies &&
        messages[messages?.length - 1]?.quickReplies.length > 0 && (
          <Flex wrap="wrap" gap="2" className="mt-2 flex-row-reverse p-3">
            {messages[messages?.length - 1]?.quickReplies?.map((reply, index) => (
              <Button
                key={index}
                size="1"
                variant="soft"
                onClick={() => handleQuickReply(reply)}
                disabled={isLoading || isDisabled}
                className="text-sm"
              >
                {reply}
              </Button>
            ))}
          </Flex>
        )}

      {/* Chat Input */}
      <Box className="flex-shrink-0 border-t p-3">
        <Flex gap="2">
          <input
            type="text"
            placeholder={
              isDisabled
                ? t('trainAssist.disabledDuringQuiz')
                : isConcluded
                  ? t('trainAssist.simulationEndedRefresh')
                  : t('trainAssist.pleaseTypeYourQuestion')
            }
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={isLoading || isDisabled || isConcluded}
            className="flex-1 rounded-md border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <IconButton
            size="3"
            variant="soft"
            disabled={isLoading || isDisabled || !localInput.trim()}
            onClick={() => handleSendMessage()}
          >
            <ArrowRightIcon />
          </IconButton>
        </Flex>
      </Box>
    </Flex>
  );
}