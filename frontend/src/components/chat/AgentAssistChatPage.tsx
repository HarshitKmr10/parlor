'use client';

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  useStreamingChatStore,
  selectIsStreaming,
  selectStreamingText,
  selectStreamingStatus,
  selectStreamingStage,
} from 'store/StreamingChat';
import type { StreamingStage } from 'store/StreamingChat';
import { useRouter, useSearchParams } from 'next/navigation';
import { Flex, Box } from '@radix-ui/themes';
import { motion } from 'framer-motion';

import {
  ChatAppResponse,
  ResponseMessage,
  createIncident,
  getIncidentFields,
} from 'api/chat';
import {
  chatApi,
  chatApiSmart,
  isStreamingSupported,
  relevantTicketRetrievalApi,
  prepareAction,
  executeAction,
  cancelAction,
  getActionStatus,
  ActionPrepareResponse,
  ActionExecuteResponse,
  StreamingCallbacks,
} from 'services/agentAssist/api';
import { QuestionInput } from 'components/QuestionInput';
import { ExampleList } from 'components/Example';
import PDFModal from 'components/Modals/PDFModal';
import { API } from 'api';
import { useGlobalContext } from 'contexts/store';
import QuestionAndAnswer from 'components/QuestionAndAnswer/QuestionAndAnswer';
import { ActionConfirmation } from './ActionConfirmation';
import { EmployeeIdModal } from './EmployeeIdModal';
import type { SuggestedAction } from './SuggestedActions';
import { useTranslation } from 'react-i18next';

export interface SupportTicket {
  id: number;
  ticket_id: string;
  subject: string;
  description?: string;
  link: string;
  status: string;
  category?: string;
  similarity_score: string;
  source_table: string;
  source_type: string;
}

type Props = {
  chatId?: string;
  employee_id?: string;
  messages?: [string, ChatAppResponse][];
  setEmployeeId?: (id: string) => void;
  version?: string;
  handleRelatedTickets: (supportTickets: SupportTicket[]) => void;
  recordNumber?: string | null;
  incidentDescription?: string;
  userSupportGroup?: string;
};

function AgentAssistChat({
  chatId = null,
  employee_id = null,
  messages = [],
  setEmployeeId = () => {},
  version = 'v1',
  handleRelatedTickets = (supportTickets: SupportTicket[]) => {},
  recordNumber = null,
  incidentDescription,
  userSupportGroup,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, organization } = useGlobalContext();
  const lastQuestionRef = useRef<string>('');
  const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
  const clientName = process.env.NEXT_PUBLIC_CLIENT;
  const assistantName = clientName === 'PROFILE_GD' ? t('agent_assist.agentAssistAI') : t('agent_assist.agentAssist');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null | undefined>(null);
  const [showCitation, setShowCitation] = useState<boolean>(false);
  const [activeCitation, setActiveCitation] = useState<string>();
  const [newChatId, setNewChatId] = useState<string>(chatId);
  const [answers, setAnswers] = useState<[user: string, response: ChatAppResponse][]>(messages);
  const [interuptInProgress, setInteruptInProgress] = useState<boolean>(false);

  // Streaming state from Zustand store - selectors optimize re-renders
  const isStreaming = useStreamingChatStore(selectIsStreaming);
  const streamingText = useStreamingChatStore(selectStreamingText);
  const streamingStatus = useStreamingChatStore(selectStreamingStatus);
  const streamingStage = useStreamingChatStore(selectStreamingStage);

  // Store actions (stable references, no need for useCallback)
  const {
    startStreaming,
    appendToken,
    updateStatus,
    finishStreaming,
    resetStreaming,
  } = useStreamingChatStore();

  // Track if streaming is complete but answer not yet replaced - use ref to avoid React batching delays
  const streamingCompleteRef = useRef<boolean>(false);

  // Action flow state
  type ActionFlowState = 'idle' | 'collecting_employee_id' | 'preparing' | 'confirming' | 'executing' | 'done';
  const [actionFlowState, setActionFlowState] = useState<ActionFlowState>('idle');
  const [selectedAction, setSelectedAction] = useState<SuggestedAction | null>(null);
  const [prepareResult, setPrepareResult] = useState<ActionPrepareResponse | null>(null);
  const [executeResult, setExecuteResult] = useState<ActionExecuteResponse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionEmployeeId, setActionEmployeeId] = useState<string>('');
  const statusPollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (messages.length === 0) {
      setAnswers([]);
      lastQuestionRef.current = '';
    }
  }, [messages]);

  // Scroll to bottom when loading starts (new message) but not when it ends
  // This prevents the jump when answer completes
  useEffect(() => {
    if (isLoading) {
      // Small delay to allow content to render first
      requestAnimationFrame(() => {
        chatMessageStreamEnd.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [isLoading]);

  // Auto-scroll during streaming to keep new content visible
  useEffect(() => {
    if (isStreaming && streamingText) {
      // Throttle scroll updates to avoid performance issues
      const scrollTimeout = setTimeout(() => {
        chatMessageStreamEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
      return () => clearTimeout(scrollTimeout);
    }
  }, [isStreaming, streamingText]);

  // Cleanup streaming state on unmount
  useEffect(() => {
    return () => {
      resetStreaming();
    };
  }, [resetStreaming]);

  // Memoized streaming answer object to prevent unnecessary re-renders
  const streamingAnswer = useMemo(() => {
    if (!streamingText) return null;
    return {
      data: {
        response_message_content: { assistant: streamingText },
        response_aids: { citations: [] },
      },
    };
  }, [streamingText]);

  // ============ Action Flow Handlers ============
  
  // Step 1: User clicks an action -> Show modal to collect employee ID
  const handleActionSelect = useCallback(async (action: SuggestedAction) => {
    setSelectedAction(action);
    setActionFlowState('collecting_employee_id');
    setActionError(null);
    setPrepareResult(null);
    setExecuteResult(null);
    setActionEmployeeId('');
  }, [t]);

  // Step 2: User submits employee ID -> Call prepare API
  const handleEmployeeIdSubmit = useCallback(async (employeeId: string) => {
    if (!user?.org_id || !newChatId || !selectedAction) {
      setActionError(t('agent_assist.missingRequiredInformation'));
      return;
    }

    setActionEmployeeId(employeeId);
    setActionFlowState('preparing');
    setActionError(null);

    console.log('[AUTOMATION] Employee ID submitted from modal:', employeeId);

    try {
      const result = await prepareAction({
        action_id: selectedAction.action_id,
        employee_id: employeeId,
        org_id: user.org_id,
        session_id: newChatId,
      });

      console.log('[AUTOMATION] Prepare result:', result);
      setPrepareResult(result);
      
      if (result.success) {
        setActionFlowState('confirming');
      } else {
        setActionError(result.error || t('agent_assist.failedToPrepareAction'));
        setActionFlowState('idle');
      }
    } catch (err: any) {
      console.error('[AUTOMATION] Prepare error:', err);
      setActionError(err.message || t('agent_assist.failedToPrepareAction'));
      setActionFlowState('idle');
    }
  }, [user?.org_id, newChatId, selectedAction, t]);

  // Stop polling for action status
  const stopStatusPolling = useCallback(() => {
    if (statusPollingRef.current) {
      console.log('[AUTOMATION] Stopping status polling');
      clearInterval(statusPollingRef.current);
      statusPollingRef.current = null;
    }
    pollingRequestIdRef.current = null;
  }, []);

  // Poll for action status
  const startStatusPolling = useCallback((requestId: string, orgId: string, sessionId: string) => {
    // Clear any existing polling
    stopStatusPolling();
    
    pollingRequestIdRef.current = requestId;
    console.log('[AUTOMATION] Starting status polling for request:', requestId);
    
    const pollStatus = async () => {
      // Safety check - stop if request ID changed or polling was stopped
      if (pollingRequestIdRef.current !== requestId) {
        console.log('[AUTOMATION] Request ID mismatch, stopping poll');
        stopStatusPolling();
        return;
      }

      try {
        console.log('[AUTOMATION] Polling status for request:', requestId);
        const statusResult = await getActionStatus({
          request_id: requestId,
          org_id: orgId,
          session_id: sessionId,
        });
        
        console.log('[AUTOMATION] Status poll result:', statusResult);
        setExecuteResult(statusResult);
        
        // Check for terminal states
        if (['completed', 'failed', 'timeout', 'error'].includes(statusResult.status)) {
          console.log('[AUTOMATION] Terminal status reached:', statusResult.status);
          stopStatusPolling();
          setActionFlowState('done');
        }
      } catch (err: any) {
        console.error('[AUTOMATION] Status poll error:', err);
        // Don't stop polling on transient errors, let it retry
        // But if too many errors, we should eventually stop
      }
    };

    // Poll immediately, then every 5 seconds
    pollStatus();
    statusPollingRef.current = setInterval(pollStatus, 5000);
    
    // Safety timeout - stop polling after 3 minutes regardless
    setTimeout(() => {
      if (pollingRequestIdRef.current === requestId) {
        console.log('[AUTOMATION] Polling timeout reached (3 min), stopping');
        stopStatusPolling();
        setActionFlowState('done');
        setExecuteResult(prev => prev ? {
          ...prev,
          status: 'timeout',
          message: 'Action timed out - please check device status manually'
        } : null);
      }
    }, 180000);
  }, [stopStatusPolling]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      stopStatusPolling();
    };
  }, [stopStatusPolling]);

  // Step 3: User confirms -> Call execute API and start polling
  const handleActionConfirm = useCallback(async () => {
    if (!user?.org_id || !newChatId || !prepareResult?.device?.device_id || !selectedAction) {
      setActionError(t('agent_assist.missingRequiredInformation'));
      return;
    }

    setActionFlowState('executing');
    setActionError(null);

    console.log('[AUTOMATION] Executing action:', selectedAction.action_id);
    console.log('[AUTOMATION] Device ID:', prepareResult.device.device_id);

    try {
      // Execute returns immediately with request_id
      const result = await executeAction({
        action_id: selectedAction.action_id,
        device_id: prepareResult.device.device_id,
        org_id: user.org_id,
        session_id: newChatId,
      });

      console.log('[AUTOMATION] Execute result:', result);
      setExecuteResult(result);
      
      // If we got a request_id and status is "executing", start polling
      if (result.request_id && result.status === 'executing') {
        console.log('[AUTOMATION] Action triggered, starting status polling');
        startStatusPolling(result.request_id, user.org_id, newChatId);
      } else if (result.status === 'error' || !result.success) {
        // Immediate error - no polling needed
        console.log('[AUTOMATION] Execute returned error, not polling');
        setActionFlowState('done');
      } else {
        // Already completed (shouldn't happen but handle it)
        setActionFlowState('done');
      }
    } catch (err: any) {
      console.error('[AUTOMATION] Execute error:', err);
      setActionError(err.message || t('agent_assist.failedToExecuteAction'));
      setActionFlowState('done');
    }
  }, [user?.org_id, newChatId, prepareResult, selectedAction, t, startStatusPolling]);

  // Cancel action at any step
  const handleActionCancel = useCallback(async () => {
    // Stop any ongoing polling
    stopStatusPolling();
    
    // Reset action state
    setActionFlowState('idle');
    setSelectedAction(null);
    setPrepareResult(null);
    setExecuteResult(null);
    setActionError(null);
    setActionEmployeeId('');

    // Optionally call cancel API
    if (user?.org_id && newChatId) {
      try {
        await cancelAction({
          session_id: newChatId,
          org_id: user.org_id,
        });
      } catch (err) {
        // Silent fail - not critical
        console.warn('Failed to cancel action:', err);
      }
    }
  }, [user?.org_id, newChatId, stopStatusPolling]);

  // ============ Chat Handlers ============
  
  const saveChat = useCallback(async ({
    question,
    response,
    session_id,
    employee_id
  }: {
    question: string, response: ChatAppResponse, session_id: string, employee_id: string
  }) => {
    // Add null check for user to prevent TypeError
    if (!user) {
      console.warn('User is not available, skipping chat save');
      return;
    }
    
    return await API.AgentChat.saveAgentMessage(
      JSON.stringify([
        question,
        {
          data: {
            response_aids: {
              citations: response.data?.response_aids?.citations,
              follow_up_questions: [],
              nudge_incident_creation: response.data?.response_aids?.nudge_incident_creation ?? {}
            },
            response_message_content: {
              assistant: response.data?.response_message_content?.assistant,
            },
          },
        },
      ]),
      session_id,
      user,
      response.data?.response_aids?.message_id,
      employee_id ?? response.data?.user_data?.employee_id,
      response.data?.response_aids?.session_title ?? '',
    );
  }, [newChatId, user]);

  const makeApiRequest = async (question: string) => {
    // Add null check for user to prevent TypeError
    if (!user || !user?.org_id || !user.id) {
      setError(t('agent_assist.userInformationNotAvailable'));
      setIsLoading(false);
      return;
    }

    lastQuestionRef.current = question;
    if (error) {
      setError(undefined);
    }
    setActiveCitation(undefined);
    setShowCitation(false);

    // Reset streaming state and set initial stage for v3/v4
    // Reset streaming complete flag at start of new request
    streamingCompleteRef.current = false;

    // Use store actions for streaming state
    if (version === 'v3' || version === 'v4') {
      startStreaming('Connecting...');
    } else {
      resetStreaming();
    }
    setIsLoading(true);

    // Add placeholder entry to answers immediately - same component handles streaming & final
    setAnswers(prev => [...prev, [question, null]]);

    try {
      // Build conversation history from completed answers only (exclude the placeholder we just added)
      const msgs: ResponseMessage[] = answers.flatMap((a) => {
        if (!a[1]) return []; // Skip entries without response
        return [
          { content: a[0], role: 'user' },
          { content: a[1].data.response_message_content.assistant, role: 'assistant' },
        ];
      });

      let currentChatId = chatId;
      if (!currentChatId) {
        currentChatId = uuidv4();
        setNewChatId(currentChatId);
      }

      // Use streaming for v3/v4 if supported
      const useStreaming = (version === 'v3' || version === 'v4') && isStreamingSupported();

      // Streaming callbacks for real-time updates using store actions
      const streamingCallbacks: StreamingCallbacks = useStreaming
        ? {
            onStatus: (message, stage) => {
              // Update stage and status message via store
              updateStatus(message, stage as StreamingStage);
            },
            onToken: (token) => {
              // Append token via store (handles accumulation internally)
              appendToken(token);
            },
            onCitations: (citations) => {
              // Citations will be in the final response
            },
            onDone: (finalData) => {
              // Mark streaming as complete - this ref is checked in render to hide loading UI
              streamingCompleteRef.current = true;
              // DON'T clear streaming state here - wait until final answer is in the array
              // to avoid flicker. finishStreaming() will be called after setAnswers() below.
            },
            onError: (errorMsg) => {
              setError(errorMsg);
              finishStreaming();
            },
          }
        : {};

      const response = await chatApiSmart(
        msgs,
        question,
        employee_id,
        currentChatId,
        user?.org_id,
        version,
        user?.id,
        {
          enableStreaming: useStreaming,
          streamingCallbacks,
        },
      );

      // Streaming state is managed by store - no manual cleanup needed here

      // For v1 and v2 versions, use the data from chat response
      handleRelatedTickets(
        response?.data?.response_aids?.relevant_tickets_sources as unknown as SupportTicket[],
      );

      if (response.data?.user_data) {
        setEmployeeId(response.data.user_data.employee_id);
      }

      let nudgeIncidentFields;

      // get incident fields if nudge incident creation is true, and update the answers
      if (response.data?.response_aids?.nudge_incident_creation?.status) {
        setInteruptInProgress(true);
        try {
          const incidentFieldsResponse = await getIncidentFields({
            app_id: 'agent_assist',
            org_id: user?.org_id,
            session_id: currentChatId,
            incident_data: response.data.response_aids.nudge_incident_creation.data,
          });
          nudgeIncidentFields = incidentFieldsResponse?.data?.fields ?? [];
          // Clear streaming and loading state
          finishStreaming();
          setIsLoading(false);

          // Replace the last (placeholder) entry with the final answer
          setAnswers(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = [
              question,
              {
                ...response,
                data: {
                  ...response.data,
                  response_aids: {
                    ...response.data.response_aids,
                    nudge_incident_creation: {
                      ...response.data.response_aids.nudge_incident_creation,
                      ...(nudgeIncidentFields?.length > 0
                        ? { incident_fields: nudgeIncidentFields }
                        : {}),
                    },
                  },
                },
              },
            ];
            return updated;
          });
          return;
        } catch (error) {
          console.error('error', error);
        }
      }

      await saveChat({
        question,
        response,
        session_id: currentChatId.toString(),
        employee_id,
      });

      // Clear streaming state and replace placeholder with final response
      finishStreaming();
      setIsLoading(false);

      // Replace the last (placeholder) entry with the final answer - same component, no flicker
      setAnswers(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = [question, response];
        return updated;
      });

      if (!chatId) {
        // Preserve existing query parameters when adding chatId
        // Use replace instead of push to avoid adding to history stack
        const currentParams = new URLSearchParams(window.location.search);
        currentParams.set('chatId', currentChatId);
        if (recordNumber) {
          currentParams.delete('record');
        }
        router.replace(`/agent-assist?${currentParams.toString()}`);
      }
    } catch (e) {
      setError(e);
      // Keep the placeholder - error will show in the last answer entry
      finishStreaming();
    } finally {
      setIsLoading(false);
    }
  };

  const submitIncidentFields = useCallback(
    async (formState: Record<string, string>) => {
      // Add null check for user to prevent TypeError
      if (!user || !user?.org_id) {
        console.error('User or user.org_id is not available, cannot submit incident fields');
        return;
      }

      const response = await createIncident({
        app_id: 'agent_assist',
        org_id: user?.org_id,
        session_id: newChatId,
        incident_data: formState,
      });
      await saveChat({
        question: lastQuestionRef.current,
        response,
        session_id: newChatId,
        employee_id,
      });
      // update last answer with the new response
      setAnswers((prevAnswers) => [
        ...prevAnswers.slice(0, -1),
        [lastQuestionRef.current, response],
      ]);
      setInteruptInProgress(false);
    },
    [newChatId, user?.org_id, employee_id],
  );

  const submitIncidentCategory = useCallback(
    async (formData: {
      category: string;
      preferred_contact_method: string;
      contact_information?: string;
      user_email?: string;
    }) => {
      // Add null check for user to prevent TypeError
      if (!user || !user?.org_id) {
        console.error('User or user.org_id is not available, cannot submit incident category');
        return;
      }

      // Build the message with all incident details for the AI to process
      let categoryMessage = `I have provided the mandatory incident details:\n`;
      categoryMessage += `Category: ${formData.category}\n`;
      categoryMessage += `Preferred Contact Method: ${formData.preferred_contact_method}\n`;

      if (formData.contact_information) {
        // For Phone or Text, include the contact number
        categoryMessage += `Contact Number: ${formData.contact_information}\n`;
      } else if (formData.user_email) {
        // For Email or MS_Teams, include the actual email address
        categoryMessage += `Contact Email: ${formData.user_email}\n`;
      } else {
        // Fallback if email is not available
        categoryMessage += `Contact: Use my ServiceNow registered email address\n`;
      }

      categoryMessage += `\nPlease create the incident ticket with these details.`;

      // Keep the current answers (card will show submitted state) and make a new request
      await makeApiRequest(categoryMessage);
    },
    [user?.org_id, makeApiRequest],
  );

  const onExampleClicked = (example: string) => {
    makeApiRequest(example);
  };

  const onShowCitation = (citation: string) => {
    setActiveCitation(citation);
    setShowCitation(true);
  };

  const latestQuickReplies = useMemo(() => {
    return answers.length > 0
      ? (answers[answers.length - 1]?.[1]?.data?.response_aids?.quick_replies ?? [])
      : [];
  }, [answers]);

  useEffect(() => {
    // when the chatId is changed, set the interuptInProgress to false
    setInteruptInProgress(false);
  }, [searchParams]);

  useEffect(() => {
    if (recordNumber && !chatId && answers.length === 0 && messages.length === 0 && !isLoading) {
      const autoMessage = t('agent_assist.fetchDetailedInformation', { 
        ticketNumber: recordNumber, 
        description: incidentDescription || '' 
      });
      makeApiRequest(autoMessage);
    }
  }, [recordNumber, chatId, answers.length, messages.length, isLoading, incidentDescription, t]);

  const renderChatContent = () => {
    if (answers.length === 0 && !lastQuestionRef.current && !messages.length) {
      return <ExampleList onExampleClicked={onExampleClicked} organization={organization} />;
    }

    return (
      <Flex direction="column" className="h-full w-full overflow-auto">
        {answers.map((answer, index) => {
          const isLastAnswer = index === answers.length - 1;
          // For last answer with null response, use streaming data
          const isCurrentlyStreaming = isLastAnswer && !answer[1] && isLoading;
          const displayAnswer = isCurrentlyStreaming && streamingText
            ? streamingAnswer
            : answer[1];

          return (
            <motion.div
              key={`${answer[0]?.substring(0, 20)}-${index}`}
              initial={isLastAnswer ? { opacity: 0.9 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <QuestionAndAnswer
                question={answer[0]}
                answer={displayAnswer}
                isLoading={isCurrentlyStreaming}
                isStreaming={isCurrentlyStreaming && isStreaming && !!streamingText}
                streamingStatus={isCurrentlyStreaming ? streamingStatus : ''}
                streamingStage={isCurrentlyStreaming ? streamingStage as any : undefined}
                error={isLastAnswer && error ? error : null}
                assistantName={assistantName}
                onCitationClicked={(c) => onShowCitation(c)}
                onRetry={isLastAnswer && error ? () => makeApiRequest(answer[0]) : () => {}}
                userName={user?.name}
                onSubmitIncidentFields={submitIncidentFields}
                onSubmitIncidentCategory={submitIncidentCategory}
                profilePic={user?.profile_pic}
                session_id={newChatId}
                app_id="agent_assist"
                latestQuickReplies={isLastAnswer && !isCurrentlyStreaming ? latestQuickReplies : undefined}
                onSend={(question) => makeApiRequest(question)}
                userSupportGroup={userSupportGroup}
                suggestedActions={isLastAnswer && !isCurrentlyStreaming ? answer[1]?.data?.response_aids?.suggested_actions : []}
                onActionSelect={isLastAnswer && !isCurrentlyStreaming ? handleActionSelect : undefined}
                isActionFlowActive={actionFlowState !== 'idle'}
              />
            </motion.div>
          );
        })}

        {/* Error handling is now in the answers loop for the last entry */}
        
        {/* Action Confirmation Flow (after employee ID is collected) */}
        {(actionFlowState === 'preparing' || actionFlowState === 'confirming' || actionFlowState === 'executing' || actionFlowState === 'done') && (
          <Box className="px-2 md:px-2">
            <ActionConfirmation
              prepareResult={prepareResult}
              executeResult={executeResult}
              isLoading={actionFlowState === 'preparing' || actionFlowState === 'executing'}
              isPreparing={actionFlowState === 'preparing'}
              isExecuting={actionFlowState === 'executing'}
              onConfirm={handleActionConfirm}
              onCancel={handleActionCancel}
              error={actionError}
            />
          </Box>
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
          isLoading={isLoading || interuptInProgress}
          isStreaming={isStreaming}
          quickReplies={latestQuickReplies}
          onSend={(question) => makeApiRequest(question)}
          followUpQuestions={
            answers.length > 0
              ? answers?.[answers.length - 1]?.[1]?.data?.response_aids?.follow_up_questions
              : []
          }
          onFollowupQuestionClicked={(q) => makeApiRequest(q)}
        />
      </Box>
      {showCitation && !!activeCitation && (
        <div className="_modal z-50">
          <PDFModal onClose={() => setShowCitation(false)} url={activeCitation} />
        </div>
      )}
      
      {/* Employee ID Modal - shows when action is selected */}
      <EmployeeIdModal
        isOpen={actionFlowState === 'collecting_employee_id'}
        actionName={selectedAction?.display_name || ''}
        actionDescription={selectedAction?.description || ''}
        onSubmit={handleEmployeeIdSubmit}
        onCancel={handleActionCancel}
        isLoading={actionFlowState === 'preparing'}
      />
    </Flex>
  );
}

export default AgentAssistChat;
