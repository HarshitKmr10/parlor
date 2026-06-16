'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Flex, Box } from '@radix-ui/themes';

import { ExpertChatApi } from 'services/ExpertCopilot/api';

import { QuestionInput } from 'components/QuestionInput';
import { ExampleList } from 'components/Example';
import PDFModal from 'components/Modals/PDFModal';
import { useGlobalContext } from 'contexts/store';
import QuestionAndAnswer from 'components/QuestionAndAnswer/QuestionAndAnswer';
import { Incident } from './IncidentList';
import { Alert } from '../../app/(admin)/noc-copilot/AlertList';
import { useTranslation } from 'react-i18next';

type Props = {
  selectedItem?: Incident | Alert | null;
  answers: [string, any][];
  setAnswers: React.Dispatch<React.SetStateAction<[string, any][]>>;
};

function ExpertChatPage({ selectedItem = null, answers, setAnswers }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, organization } = useGlobalContext();
  const lastQuestionRef = useRef<string>('');
  const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<unknown>();
  const [showCitation, setShowCitation] = useState<boolean>(false);
  const [activeCitation, setActiveCitation] = useState<string>();

  useEffect(() => {
    if (selectedItem) {
      const initialResponse: any = {
        id: 'chatcmpl-9QzsYBJMh9BunpueZlcyHcEJa8G04',
        choices: [
          {
            finish_reason: 'stop',
            index: 0,
            logprobs: null,
            message: {
              content: `<b>${selectedItem.title}</b>` + '<br>' + `${selectedItem.summary}`,
              role: 'assistant',
              function_call: null,
              tool_calls: null,
            },
            context: {
              data_points: null,
              thoughts: [
                {
                  title: 'Primary Cache',
                  description: {
                    user_id: null,
                    user_id_check_failed: false,
                    ticket_data: {
                      action_type: '',
                      ticket_id: '',
                      ticket_subject: '',
                      ticket_description: '',
                      ticket_urgency: '',
                      ticket_impact: '',
                    },
                    ticket_confirmation_data: {
                      ticket_action_requested: false,
                      ticket_details_observed: false,
                      ticket_action_confirmed: false,
                    },
                    issues_resolved: [],
                    issues_unresolved: [],
                    optimized_questions_so_far: [],
                  },
                  props: null,
                },
                {
                  title: 'Rag Context',
                  description: ['Hello! How can I assist you today?'],
                  props: null,
                },
                {
                  title: 'Incident History',
                  description: null,
                  props: null,
                },
                {
                  title: 'Original user query',
                  description: 'hello',
                  props: null,
                },
                {
                  title: 'Prompt',
                  description: [
                    "{'role': 'system', 'content': \"You are an AI Assistant who is talking to IT Service Desk agent and giving them instructions. You help the company's IT service desk agents with their IT-related questions.Always answer the query using the provided context information and not prior knowledge.Some rules to follow:\\n1. Never directly reference the given context in your answer.\\n2. Avoid statements like 'Based on the context, ...' or 'The context information ...' or anything along those lines.\\n3.Note that the reliability of information from these sources may vary. The AI is expected to critically evaluate the relevance and accuracy of information from each source, recognizing that some may be more reliable than others at different times.\\n4. Dont refer the source directly in the response at any cost for any chit chat messages like hi, hello or aything infact\\n5. For a greeting message towards beginning of the conversation respond with a warm greeting and politely ask how can you assist the agent\\nYour goal is to synthesize this information to provide relevant and brief answers. Do not provide the source names like IT Specialist Agent Response or User Input directly in the answer\\nSeamlessly integrate information from various sources to address the agent's query effectively. These sources include:\\n**User Input**: Prioritize the most recent user query.\\n**RAG Context**: ###1. Draw on the most relevant pieces of information from the company knowledge-articles related to the user query.\\n                ###2. Ensure to keep the formatting and Complete Content from  **RAG Context** in the final response to agent\\n                ###3. Give answer in step by step format whereever possible\\n**Conversation History**: Reference the dialogue history for additional context when beneficial.\\n\\nNote that the reliability of information from these sources may vary. The AI is expected to critically evaluate the relevance and accuracy of information from each source, recognizing that some may be more reliable than others at different times.\\nYour goal is to synthesize this information to provide relevant and brief answers.\"}",
                    "{'role': 'user', 'content': \"With the guidelines stated, please provide a step-by-step response to the user query when showing a sequence of steps, for normal responses or questions to agent keep it conversational.\\nuse only the provided information from specilaist agents, and no other sources or prior knowledge. Context information is below.\\n---------------------\\n###Conversation History: \\n[{'content': 'hi', 'role': 'user'}, {'content': 'Hello! How can I assist you today?', 'role': 'assistant'}, {'content': 'hello', 'role': 'user'}]\\n\\n###RAG Context: \\n['Hello! How can I assist you today?']\\n\\n###User Input: \\nhello\\n\\n---------------------\\n\"}",
                  ],
                  props: null,
                },
              ],
              followup_questions: [],
              citations: [],
              user: null,
            },
          },
        ],
        created: 1716221418,
        model: 'gpt-3.5-turbo-0125',
        object: 'chat.completion',
        system_fingerprint: null,
        usage: {
          completion_tokens: 9,
          prompt_tokens: 541,
          total_tokens: 550,
        },
      };
      setAnswers([['', initialResponse]]);
    }
  }, [selectedItem]);

  useEffect(
    () => chatMessageStreamEnd.current?.scrollIntoView({ behavior: 'smooth' }),
    [isLoading],
  );

  const makeApiRequest = async (question: string) => {
    lastQuestionRef.current = question;
    setIsLoading(true);
    setError(undefined);
    setActiveCitation(undefined);
    setShowCitation(false);

    try {
      const messages: any[] = answers.flatMap((a) => [
        { content: a[0], role: 'user' },
        { content: a[1].choices[0].message.content, role: 'assistant' },
      ]);

      const response = await ExpertChatApi(
        messages,
        question,
        selectedItem?.id,
        user?.org_id,
        'v1',
      );

      console.log("response", JSON.stringify(response));

      setAnswers([...answers, [question, response]]);
    } catch (e) {
      setError(e);
    } finally {
      setIsLoading(false);
    }
  };

  const onExampleClicked = (example: string) => {
    makeApiRequest(example);
  };

  const onShowCitation = (citation: string) => {
    setActiveCitation(citation);
    setShowCitation(true);
  };

  const renderChatContent = () => {
    if (answers.length === 0 && !lastQuestionRef.current) {
      return <ExampleList onExampleClicked={onExampleClicked} organization={organization} />;
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
            assistantName={t('expert_copilot.expertCoResolve')}
            onCitationClicked={(c) => onShowCitation(c)}
            onRetry={() => {}}
            userName={user?.name}
            profilePic={user?.profile_pic}
            hideNoContent={!answer[0]}
          />
        ))}

        {isLoading && (
          <QuestionAndAnswer
            question={lastQuestionRef.current}
            answer={null}
            isLoading
            error={null}
            assistantName={t('expert_copilot.expertCoResolve')}
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
            error={error.toString()}
            assistantName={t('expert_copilot.expertCoResolve')}
            onCitationClicked={() => {}}
            onRetry={() => makeApiRequest(lastQuestionRef.current)}
            userName={user?.name}
            profilePic={user?.profile_pic}
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
          onFollowupQuestionClicked={(q) => makeApiRequest(q)}
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

export default ExpertChatPage;
