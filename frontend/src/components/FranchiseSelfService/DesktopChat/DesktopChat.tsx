'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Flex, Box, Text, Avatar } from '@radix-ui/themes';

import { ExpertChatApi } from 'services/ExpertCopilot/api';

import { QuestionInput } from 'components/QuestionInput';
import { ExampleList } from 'components/Example';
import PDFModal from 'components/Modals/PDFModal';
import { useGlobalContext } from 'contexts/store';
import QuestionAndAnswer from 'components/QuestionAndAnswer/QuestionAndAnswer';
import { Incident } from '../../chat/IncidentList';
import { Alert } from '../../../app/(admin)/noc-copilot/AlertList';

// >>> NEW: import your demo content <<<
import { demoResponses } from './demoResponses';
import { demoQuestions } from './demoQuestions';

type Props = {
  selectedItem?: Incident | Alert | null;
  answers: [string, any][];
  setAnswers: React.Dispatch<React.SetStateAction<[string, any][]>>;
};

// Demo thinking animation component with ChatGPT-style typing effect
const ThinkingAnimation = ({ message }: { message: string }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const words = message.split(' ');

  // Reset animation when message changes
  useEffect(() => {
    setDisplayedText('');
    setCurrentWordIndex(0);
    setIsComplete(false);
  }, [message]);
  
  useEffect(() => {
    if (currentWordIndex < words.length) {
      const timer = setTimeout(
        () => {
          setDisplayedText((prev) => prev + (prev ? ' ' : '') + words[currentWordIndex]);
          setCurrentWordIndex((prev) => prev + 1);
        },
        currentWordIndex === 0 ? 200 : 120,
      );

      return () => clearTimeout(timer);
    } else if (currentWordIndex === words.length) {
      setIsComplete(true);
    }
  }, [currentWordIndex, words]);
  
  return (
    <Flex direction="column" gap="3" className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <Flex align="center" gap="3">
        <div className="flex space-x-1">
          <div className="h-1 w-1 animate-pulse rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
          <div className="h-1 w-1 animate-pulse rounded-full bg-gray-400" style={{ animationDelay: '200ms' }} />
          <div className="h-1 w-1 animate-pulse rounded-full bg-gray-400" style={{ animationDelay: '400ms' }} />
        </div>
        <Box className="min-h-[1.5rem]">
          <Text
            size="2"
            color="gray"
            className="leading-relaxed transition-all duration-300 ease-out"
            style={{ opacity: displayedText ? 1 : 0, transform: displayedText ? 'translateY(0)' : 'translateY(10px)' }}
          >
            {displayedText}
            {!isComplete && displayedText.length > 0 && (
              <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-gray-400"></span>
            )}
      </Text>
        </Box>
      </Flex>
    </Flex>
  );
};

function DeskopChat({ selectedItem = null, answers, setAnswers }: Props) {
  const router = useRouter();
  const { user, organization } = useGlobalContext();
  const lastQuestionRef = useRef<string>('');
  const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<unknown>();
  const [showCitation, setShowCitation] = useState<boolean>(false);
  const [activeCitation, setActiveCitation] = useState<string>();
  
  // Demo state
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [thinkingMessage, setThinkingMessage] = useState<string>('');
  const [demoStep, setDemoStep] = useState<number>(0);

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
              thoughts: [],
              followup_questions: [],
              citations: [],
              user: null,
            },
          },
        ],
        created: Math.floor(Date.now() / 1000),
        model: 'demo-mode',
        object: 'chat.completion',
        system_fingerprint: null,
        usage: { completion_tokens: 9, prompt_tokens: 541, total_tokens: 550 },
      };
      // Reset step for each selection
      setDemoStep(0);
      setAnswers([['', initialResponse]]);
    }
  }, [selectedItem, setAnswers]);

  useEffect(
    () => chatMessageStreamEnd.current?.scrollIntoView({ behavior: 'smooth' }),
    [isLoading, answers],
  );

  // UTIL: tiny matcher
  const hasAny = (text: string, kws: string[] = []) =>
    kws.some(k => text.includes(k.toLowerCase()));

  // Demo thinking animation flow
  const simulateThinking = async (message: string) => {
    setIsThinking(true);
    const steps = message.split('.').filter(s => s.trim().length);
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i].trim() + '.';
      setThinkingMessage(step);
      const stepDuration = i === 0 ? 3000 : 2500;
      await new Promise(res => setTimeout(res, stepDuration));
    }
    await new Promise(res => setTimeout(res, 1000));
    setIsThinking(false);
    setThinkingMessage('');
  };

  const addDemoResponse = (content: string) => {
    const demoResponse: any = {
      id: `demo-${Date.now()}`,
      choices: [
        {
          finish_reason: 'stop',
          index: 0,
          logprobs: null,
          message: { content, role: 'assistant', function_call: null, tool_calls: null },
          context: { data_points: null, thoughts: [], followup_questions: [], citations: [], user: null },
        },
      ],
      created: Math.floor(Date.now() / 1000),
      model: 'demo-mode',
      object: 'chat.completion',
      system_fingerprint: null,
      usage: { completion_tokens: Math.ceil(content.length / 4), prompt_tokens: 100, total_tokens: Math.ceil(content.length / 4) + 100 },
    };
    setAnswers(prev => [...prev, ['', demoResponse]]);
  };

  // >>> NEW: unified demo handler for ANY incident defined in demoResponses
  const handleDemoQuestion = async (question: string) => {
    const id = selectedItem?.id || '';
    const playbook = (demoResponses as any)[id];
    const qset = (demoQuestions as any)[id];

    if (!playbook || !qset) return false; // not a demo incident

    // record the user message into the transcript
    const userMessageResponse = { id: `user-${Date.now()}`, choices: [{ message: { content: question, role: 'user' } }] };
        setAnswers(prev => [...prev, [question, userMessageResponse]]);

    const q = question.toLowerCase();

    // Check for ticket creation intent first (before step-based flow)
    const ticketCreationKeywords = ['create', 'ticket', 'report', 'new', 'submit', 'open'];
    if (hasAny(q, ticketCreationKeywords) && playbook.createTicket?.requestInfo) {
      await simulateThinking('Preparing ticket creation form... Gathering required information...');
      addDemoResponse(playbook.createTicket.requestInfo);
      return true;
    }

    // Check for PC number response (standalone or after ticket creation request)
    const pcNumberPattern = /(pc|system|computer)\s*(\d+)/i;
    const pcMatch = q.match(pcNumberPattern);
    if (pcMatch && playbook.createTicket?.ticketCreated) {
      const pcNumber = pcMatch[2] || pcMatch[1];
      const issueDescription = selectedItem?.title || 'Printer Issue';
      const storeLocation = (selectedItem as any)?.Location || 'Store Location';
      
      await simulateThinking('Creating ticket... Generating ticket ID... Assigning to support group...');
      const ticketResponse = playbook.createTicket.ticketCreated(pcNumber, issueDescription, 'Critical', storeLocation);
      addDemoResponse(ticketResponse);
      return true;
    }

    // Check for first question (issue description) - match qset[0]
    if (qset[0]?.keywords && hasAny(q, qset[0].keywords)) {
      await simulateThinking('Analyzing the issue... Checking device/app state... Reviewing similar tickets...');
      addDemoResponse(playbook.performanceAnalysis);
      setDemoStep(1);
      return true;
    }

    // Check for second question (troubleshooting steps) - match qset[1]
    if (qset[1]?.keywords && hasAny(q, qset[1].keywords)) {
      // Check if there's a stock-specific variant
      const stockHit = qset[1]?.stockKeywords && hasAny(q, qset[1].stockKeywords);
      if (stockHit && playbook.ramStockCheck) {
        await simulateThinking('Checking inventory/config... Verifying compatibility...');
        addDemoResponse(playbook.ramStockCheck);
        setDemoStep(2);
        return true;
      }
      // Otherwise give resolution plan
      await simulateThinking('Preparing resolution steps... Validating prerequisites...');
      addDemoResponse(playbook.resolutionPlan);
      setDemoStep(2);
      return true;
    }

    // Check for third question (ticket creation) - match qset[2]
    if (qset[2]?.keywords && hasAny(q, qset[2].keywords)) {
      await simulateThinking('Preparing ticket creation form... Gathering required information...');
      addDemoResponse(playbook.createTicket?.requestInfo || 'I can help you create a ticket.');
      return true;
    }

    // Check for CrunchTime user guide question - match on crunchtime + user/locations
    if (playbook.crunchTimeUserGuide && hasAny(q, ['crunchtime']) && hasAny(q, ['user', 'add', 'locations', 'network', 'enterprise'])) {
      await simulateThinking('Retrieving CrunchTime user guide... Checking Enterprise Manager setup...');
      addDemoResponse(playbook.crunchTimeUserGuide);
      return true;
    }

    // Check for employee login/setup guide question - match on employee + login/setup + pos/oracle/sync
    if (playbook.employeeLoginGuide && hasAny(q, ['employee']) && hasAny(q, ['login', 'setup']) && hasAny(q, ['pos', 'oracle', 'sync', 'emc', 'check'])) {
      await simulateThinking('Retrieving employee setup guide... Checking Oracle R&A and EMC configuration...');
      addDemoResponse(playbook.employeeLoginGuide);
      return true;
    }

    // Fallback for anything else while in demo mode
    await simulateThinking('Processing your request...');
    addDemoResponse(playbook.genericResponse || 'I can help you with next steps or create a ticket if needed.');
    return true;
  };

  const makeApiRequest = async (question: string) => {
    lastQuestionRef.current = question;
    
    // If this incident is supported by our demo playbooks, route to handleDemoQuestion
    if (selectedItem?.id && (demoResponses as any)[selectedItem.id]) {
      const handled = await handleDemoQuestion(question);
      if (handled) return;
    }
    
    // Otherwise: call backend
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
        {answers.map((answer, index) => {
          // For initial responses with empty questions, only show the answer
          if (!answer[0] && answer[1]) {
            // Check if the answer has meaningful content
            const messageContent = answer[1]?.choices?.[0]?.message?.content;
            if (!messageContent || messageContent.trim() === '' || messageContent.includes('No content provided')) {
              return null; // Don't render anything if no meaningful content
            }
            
            return (
              <QuestionAndAnswer
                key={index}
                question=""
                  answer={answer[1]}
                isLoading={false}
                error={null}
                assistantName="Franchise Self Service"
                  onCitationClicked={onShowCitation}
                onRetry={() => {}}
                userName={user?.name}
                profilePic={user?.profile_pic}
                hideNoContent={true}
                />
            );
          }
          
          // For user message responses (role: 'user'), show as user message
          if (answer[1]?.choices?.[0]?.message?.role === 'user') {
            // Check if the user message has meaningful content
            const userMessageContent = answer[1].choices[0].message.content;
            if (!userMessageContent || userMessageContent.trim() === '' || userMessageContent.includes('No content provided')) {
              return null; // Don't render anything if no meaningful content
            }
            
            return (
              <Flex key={index} direction="column" className="flex flex-col">
                <Box className="bg-[var(--accent-3)] p-2">
                  <Flex gap="2">
                    <div className="hidden md:block">
                      <Avatar
                        size="2"
                        src={user?.profile_pic}
                        fallback={user?.name ? user.name[0].toUpperCase() : 'U'}
                        radius="medium"
                        variant="solid"
                      />
                    </div>
                    <Flex direction="column" minWidth="0">
                      <Text size="2" weight="bold" className="hidden md:block" style={{ color: 'var(--pink-9)' }}>
                        You
                      </Text>
                      <Text size="2">{userMessageContent}</Text>
                    </Flex>
                  </Flex>
                </Box>
              </Flex>
            );
          }
          
          // Check if the answer has meaningful content before rendering
          const messageContent = answer[1]?.choices?.[0]?.message?.content;

          if (!messageContent || messageContent.trim() === '' || messageContent.includes('No content provided')) {
            return null; // Don't render anything if no meaningful content
          }
          
          return (
            <QuestionAndAnswer
              key={index}
              question={answer[0]}
              answer={answer[1]}
              isLoading={false}
              error={null}
              assistantName="Franchise Self Service"
              onCitationClicked={(c) => onShowCitation(c)}
              onRetry={() => {}}
              userName={user?.name}
              profilePic={user?.profile_pic}
              hideNoContent={true}
            />
          );
        })}

        {isLoading && (
          <QuestionAndAnswer
            question={lastQuestionRef.current}
            answer={null}
            isLoading
            error={null}
            assistantName="Franchise Self Service"
            onCitationClicked={() => {}}
            onRetry={() => {}}
            userName={user?.name}
            profilePic={user?.profile_pic}
            hideNoContent={true}
          />
        )}

        {isThinking && (
          <Flex justify="start" className="mb-4 p-4">
            <ThinkingAnimation message={thinkingMessage} />
          </Flex>
        )}

        {error && (
          <QuestionAndAnswer
            question={lastQuestionRef.current}
            answer={null}
            isLoading={false}
            error={String(error)}
            assistantName="Franchise Self Service"
            onCitationClicked={() => {}}
            onRetry={() => makeApiRequest(lastQuestionRef.current)}
            userName={user?.name}
            profilePic={user?.profile_pic}
            hideNoContent={true}
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
          isLoading={isLoading || isThinking}
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

export default DeskopChat;