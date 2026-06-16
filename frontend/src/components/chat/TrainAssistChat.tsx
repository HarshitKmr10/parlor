import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/navigation';
import {
  trainAssistChatApi,
  ChatAppRequest,
  ChatAppResponse,
  RetrievalMode,
  VectorFieldOptions,
  GPT4VInput,
} from 'api/chat';
import { useGlobalContext } from 'contexts/store';
import QuestionAndAnswer from 'components/QuestionAndAnswer/QuestionAndAnswer';
import { Button, Flex } from '@radix-ui/themes';
import { PlusIcon } from 'lucide-react';
import { QuestionInput } from 'components/QuestionInput';

const clientName = process.env.NEXT_PUBLIC_CLIENT;

type ChatContext = {
  category: string;
  module: string;
  chat_type: string;
  kb?: string;
};

type Props = {
  chatId?: string;
  employee_id?: string;
  messages?: [string, ChatAppResponse][];
  setEmployeeId?: (id: string) => void;
  initialContext: ChatContext;
};

const TrainAssistChat = forwardRef<
{ sendMessage:(message: string, context: ChatContext) => void },
Props
>(
  (
    {
      chatId = null,
      employee_id = null,
      messages = [],
      setEmployeeId = () => {},
      initialContext,
    },
    ref,
  ) => {
    const router = useRouter();
    const { user, organization } = useGlobalContext();
    const [chatMessages, setChatMessages] = useState<
    [string, ChatAppResponse][]
    >(messages);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [currentContext, setCurrentContext] = useState<ChatContext>(initialContext);

    const chatAppRequestContextSettings = {
      promptTemplate: '',
      retrieveCount: 7,
      retrievalMode: RetrievalMode.Vectors,
      useSemanticRanker: true,
      shouldStream: false,
      useSemanticCaptions: false,
      excludeCategory: '',
      vectorFieldList: [VectorFieldOptions.Embedding],
      suggestFollowupQuestions: true,
      useOidSecurityFilter: false,
      useGroupsSecurityFilter: false,
      gpt4vInput: GPT4VInput.TextAndImages,
      useGPT4V: false,
    };

    useEffect(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, [chatMessages]);

    const sendMessage = async (message: string, context: ChatContext) => {
      if (!message.trim() || isLoading) return;

      setIsLoading(true);
      setCurrentContext(context);
      const newMessages: [string, ChatAppResponse][] = [
        ...chatMessages,
        [message, {} as ChatAppResponse],
      ];
      setChatMessages(newMessages);
      setInputMessage('');

      try {
        const currentChatId = chatId || uuidv4();
        const request: ChatAppRequest = {
          messages: [
            ...newMessages.flatMap((msg) => [
              { content: msg[0], role: 'user' },
              {
                content: msg[1].data?.response_message_content?.assistant || '',
                role: 'assistant',
              },
            ]),
            { content: message, role: 'user' },
          ],
          stream: false,
          user: employee_id
            ? {
              employee_id,
              employee_name: null,
              email: null,
              phone_number: null,
            }
            : null,
          context: {
            overrides: {
              session_title: null,
              prompt_template:
                chatAppRequestContextSettings.promptTemplate.length === 0
                  ? undefined
                  : chatAppRequestContextSettings.promptTemplate,
              exclude_category:
                chatAppRequestContextSettings.excludeCategory.length === 0
                  ? undefined
                  : chatAppRequestContextSettings.excludeCategory,
              top: chatAppRequestContextSettings.retrieveCount,
              retrieval_mode: chatAppRequestContextSettings.retrievalMode,
              semantic_ranker: chatAppRequestContextSettings.useSemanticRanker,
              semantic_captions:
                chatAppRequestContextSettings.useSemanticCaptions,
              suggest_followup_questions:
                chatAppRequestContextSettings.suggestFollowupQuestions,
              use_oid_security_filter:
                chatAppRequestContextSettings.useOidSecurityFilter,
              use_groups_security_filter:
                chatAppRequestContextSettings.useGroupsSecurityFilter,
              vector_fields: chatAppRequestContextSettings.vectorFieldList,
              use_gpt4v: chatAppRequestContextSettings.useGPT4V,
              gpt4v_input: chatAppRequestContextSettings.gpt4vInput,
              session_id: currentChatId,
              app_id: 'agent-assist',
              ...context,
            },
          },
          org_id: user?.org_id,
        };

        const response = await trainAssistChatApi(request);
        const res = response.data;
        res.data.response_message_content.assistant = JSON.parse(res.data.response_message_content.assistant).chat_response;

        setChatMessages([
          ...newMessages.slice(0, -1),
          [message, res] as [string, ChatAppResponse],
        ]);
      } catch (error) {
        console.error('Error sending message:', error);
        // Handle error (e.g., show an error message to the user)
      } finally {
        setIsLoading(false);
      }
    };

    useImperativeHandle(ref, () => ({
      sendMessage,
    }));

    const clearChat = () => {
      setChatMessages([]);
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = 0;
      }
    };

    return (
      <div className="flex flex-col h-full relative">
        <Flex justify="end" className="p-4 text-sm text-gray-600 border-b">
          <Button
            variant="ghost"
            className="mr-2 flex items-center"
            onClick={clearChat}
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            <span>New Chat</span>
          </Button>
        </Flex>
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto mb-4">
          {chatMessages.map(([question, answer], index) => (
            <QuestionAndAnswer
              key={index}
              question={question}
              answer={answer}
              isLoading={isLoading && index === chatMessages.length - 1}
              error={null}
              assistantName={clientName === 'PROFILE_GD' ? 'Training Assist AI' : 'Train Assist'}
              onCitationClicked={(c) => {}}
              onRetry={() => {}} // No retry needed for successful answers
              userName={user?.name}
              profilePic={user?.profile_pic}
            />
          ))}
        </div>
        <div className="p-1 border-t bg-white sticky bottom-0">
          <QuestionInput
            clearOnSend
            isLoading={isLoading}
            isStreaming={false}
            onSend={(question) => sendMessage(question, currentContext)}
            followUpQuestions={[]}
            onFollowupQuestionClicked={(q) => {}}
          />
        </div>
      </div>
    );
  });
TrainAssistChat.displayName = 'TrainAssistChat';
export default TrainAssistChat;
