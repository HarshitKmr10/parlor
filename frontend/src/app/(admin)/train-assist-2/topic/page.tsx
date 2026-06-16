'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, BookOpen, CheckCircle } from 'lucide-react';
import { Button, Badge, Flex, Text, Dialog } from '@radix-ui/themes';
import { useSearchParams, useRouter } from 'next/navigation';
import { getTrainAssistTopicById, TrainAssistTopic } from '../../../../api/trainAssist';
import ChatAssist from '../components/ChatAssist';
import QuizTab from '../components/QuizTab';
import ContentTab from '../components/ContentTab';
import { PostcallTopics } from '../../../../api/postcallTopcs';
import { useGlobalContext } from '../../../../contexts/store';
import SimulationTab from '../components/SimulationTab';
import { useTranslation } from 'react-i18next';

export default function TopicPage() {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(1);
  const [chatInput, setChatInput] = useState('');
  const [view, setView] = useState<'topic' | 'quiz-intro' | 'quiz' | 'quiz-results' | 'simulation'>(
    'topic',
  ); // 'topic', 'quiz-intro', 'quiz', or 'quiz-results'
  const [topic, setTopic] = useState<TrainAssistTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentModule, setCurrentModule] = useState(0);
  const [isTopicCompleted, setIsTopicCompleted] = useState(false);
  const [loadingDocumentId, setLoadingDocumentId] = useState<string | null>(null);
  const [quizResults, setQuizResults] = useState<{
    score: number;
    correct_count: number;
    total_questions: number;
    feedback: Array<{
      question_index: number;
      is_correct: boolean;
      correct_answer: number;
      explanation: string;
    }>;
  } | null>(null);
  const [showNavigationDialog, setShowNavigationDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<'backToTopics' | 'topicTab' | null>(
    null,
  );

  const [simulationSessionId, setSimulationSessionId] = useState<string | null>(null);
  const [initialSimMessage, setInitialSimMessage] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(true);

  const [hasMounted, setHasMounted] = useState(false);

  const lessonSectionRef = useRef<HTMLDivElement>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const topicId = searchParams.get('id');
  const collectionId = searchParams.get('collection');

  const { user, organization } = useGlobalContext();

  // Parse organization config
  const config = useMemo(() => {
    try {
      return JSON.parse(organization?.config || '{}');
    } catch {
      return {};
    }
  }, [organization?.config]);

  // Check if quiz is in progress
  const isQuizInProgress = view === 'quiz';

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const fetchTopic = async () => {
      if (!topicId) {
        setError(t('trainAssist.noTopicIdProvided'));
        setLoading(false);
        return;
      }

      try {
        const fetchedTopic = await getTrainAssistTopicById(topicId);
        setTopic(fetchedTopic);

        // Check if topic is completed (has quiz activity)
        if (
          fetchedTopic.train_assist_activity &&
          fetchedTopic.train_assist_activity.length > 0 &&
          fetchedTopic.train_assist_activity.some((activity) => activity.type === 'quiz')
        ) {
          setIsTopicCompleted(true);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching topic:', err);
        setError(t('trainAssist.failedToLoadTopic'));
        setLoading(false);
      }
    };

    fetchTopic();
  }, [topicId, t]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    console.log('tab', tab);

    if (tab === 'simulation') {
      setView('simulation');

      // Remove the tab query param from the URL
      const newParams = new URLSearchParams(Array.from(searchParams.entries()));
      newParams.delete('tab');

      const newUrl = `/train-assist-2/topic?${newParams.toString()}`;
      router.replace(newUrl);
    }
  }, [searchParams, router]);

  const handleNextStep = () => {
    if (view === 'topic') {
      if (topic && topic.details.modules && currentModule < topic.details.modules.length - 1) {
        setCurrentModule(currentModule + 1);
        // Scroll lesson section to top
        if (lessonSectionRef.current) {
          lessonSectionRef.current.scrollTop = 0;
        }
      } else if (activeStep < 4) {
        setActiveStep(activeStep + 1);
        // Scroll lesson section to top
        if (lessonSectionRef.current) {
          lessonSectionRef.current.scrollTop = 0;
        }
      }
    }
  };

  const handleStepClick = useCallback((index: number) => {
    setCurrentModule(index);
    if (lessonSectionRef.current) {
      lessonSectionRef.current.scrollTop = 0;
    }
  }, []);

  const handlePreviousStep = () => {
    if (view === 'topic') {
      if (currentModule > 0) {
        setCurrentModule(currentModule - 1);
        // Scroll lesson section to top
        if (lessonSectionRef.current) {
          lessonSectionRef.current.scrollTop = 0;
        }
      } else if (activeStep > 1) {
        setActiveStep(activeStep - 1);
        // Scroll lesson section to top
        if (lessonSectionRef.current) {
          lessonSectionRef.current.scrollTop = 0;
        }
      }
    }
  };

  const handleQuizSelection = () => {
    setView('quiz-intro');
    // Scroll lesson section to top when switching to quiz intro
    if (lessonSectionRef.current) {
      lessonSectionRef.current.scrollTop = 0;
    }
  };

  const handleBackToTopics = () => {
    if (isQuizInProgress) {
      setPendingNavigation('backToTopics');
      setShowNavigationDialog(true);
    } else {
      router.push(collectionId ? `/train-assist-2?collection=${collectionId}` : '/train-assist-2');
    }
  };

  const handleDocumentClick = async (documentId: string) => {
    try {
      // Set loading state for this document
      setLoadingDocumentId(documentId);

      // Convert document to PDF
      const pdfBlob = await PostcallTopics.convertDocumentToPdf(documentId, user);

      // Create a URL for the blob
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Open the PDF in a new tab
      window.open(pdfUrl, '_blank');

      // Clean up the URL object after the window is opened
      setTimeout(() => {
        URL.revokeObjectURL(pdfUrl);
      }, 100);
    } catch (error) {
      console.error('Error converting document to PDF:', error);

      // Fallback to opening the editor if PDF generation fails
      window.open(`/knowledge/editor/edit-document?id=${documentId}`, '_blank');
    } finally {
      // Reset loading state
      setLoadingDocumentId(null);
    }
  };

  const handleTopicTabClick = () => {
    if (isQuizInProgress) {
      setPendingNavigation('topicTab');
      setShowNavigationDialog(true);
    } else {
      setView('topic');
      // Scroll lesson section to top when switching to topic tab
      if (lessonSectionRef.current) {
        lessonSectionRef.current.scrollTop = 0;
      }
    }
  };

  const handleProceedToSimulation = useCallback(() => {
    setView('simulation');
  }, []);

  const handleSimulationClick = useCallback(() => {
    setView('simulation');
  }, []);

  const handleConfirmNavigation = () => {
    if (pendingNavigation === 'backToTopics') {
      router.push(collectionId ? `/train-assist-2?collection=${collectionId}` : '/train-assist-2');
    } else if (pendingNavigation === 'topicTab') {
      setView('topic');
      // Scroll lesson section to top when switching to topic tab
      if (lessonSectionRef.current) {
        lessonSectionRef.current.scrollTop = 0;
      }
    }
    setShowNavigationDialog(false);
    setPendingNavigation(null);
  };

  const handleCancelNavigation = () => {
    setShowNavigationDialog(false);
    setPendingNavigation(null);
  };

  const handleStartSimulation = useCallback(
    ({
      simulation_session_id,
      initial_customer_message,
    }: {
      simulation_session_id: string;
      initial_customer_message: string;
    }) => {
      // Step 1: Remove ChatAssist from DOM
      setShowChat(false);

      // Step 2: Reset session-related states
      setChatInput('');
      setSimulationSessionId(null);
      setInitialSimMessage(null);

      // Step 3: Slight delay to ensure unmount before remount
      setTimeout(() => {
        setSimulationSessionId(simulation_session_id);
        setInitialSimMessage(initial_customer_message);
        setShowChat(true); // Re-render ChatAssist
      }, 50);
    },
    [],
  );

  const onRefreshChat = useCallback(() => {
    setChatInput('');
  }, []);

  // Get cooloff period from organization config
  const cooloffPeriod = useMemo(() => {
    if (!organization?.config) return 0;
    try {
      const config = JSON.parse(organization.config);
      return config?.Modules?.train_assist?.quiz_cooloff_period ?? 0;
    } catch (error) {
      console.error('Error parsing organization config:', error);
      return 0;
    }
  }, [organization?.config]);

  // Check if quiz tab should be enabled
  const isQuizTabEnabled = useMemo(() => {
    // If no cooloff period is configured, quiz is always available
    if (cooloffPeriod === 0) return true;

    // If there's a cooloff period, quiz is only available when not in quiz views
    // (user needs to complete the topic first)
    return view === 'quiz-intro' || view === 'quiz' || view === 'quiz-results';
  }, [cooloffPeriod, view]);

  const handleQuizTabClick = () => {
    if (!isQuizTabEnabled) return;

    if (isQuizInProgress) {
      setPendingNavigation('topicTab');
      setShowNavigationDialog(true);
    } else {
      setView('quiz-intro');
      // Scroll lesson section to top when switching to quiz tab
      if (lessonSectionRef.current) {
        lessonSectionRef.current.scrollTop = 0;
      }
    }
  };

  useEffect(() => {
    // Only trigger refresh when moving away from 'simulation'
    if (view !== 'simulation' || view === 'simulation') {
      // Step 1: Remove ChatAssist from DOM
      setShowChat(false);

      // Step 2: Reset session-related states
      setChatInput('');
      setSimulationSessionId(null);
      setInitialSimMessage(null);

      // Re-mount ChatAssist after a short delay
      const timeout = setTimeout(() => {
        setShowChat(true);
      }, 500);

      return () => clearTimeout(timeout);
    }
  }, [view]);

  if (!hasMounted) return null;

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Navigation Confirmation Dialog */}
      <Dialog.Root open={showNavigationDialog} onOpenChange={setShowNavigationDialog}>
        <Dialog.Content>
          <Dialog.Title>{t('trainAssist.quizInProgress')}</Dialog.Title>
          <Dialog.Description>
            {t('trainAssist.quizProgressWarning')}
          </Dialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray" onClick={handleCancelNavigation}>
                {t('trainAssist.cancel')}
              </Button>
            </Dialog.Close>
            <Button variant="solid" color="red" onClick={handleConfirmNavigation}>
              {t('trainAssist.leaveAnyway')}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Header */}
      <header className="flex items-center justify-between border-b bg-white p-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            color="gray"
            onClick={handleBackToTopics}
            className="flex cursor-pointer items-center gap-2"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-xl font-medium">
              {loading ? t('trainAssist.loading') : error ? t('trainAssist.error') : topic?.title || t('trainAssist.topic')}
            </span>
          </Button>

          {/* Completion status badge */}
          {!loading && !error && (
            <Flex align="center" gap="2">
              {isTopicCompleted ? (
                <Badge color="green" variant="solid" className="ml-2 rounded-sm">
                  <Flex gap="1" align="center">
                    <Text>{t('trainAssist.completed')}</Text>
                  </Flex>
                </Badge>
              ) : (
                <Badge color="gray" variant="outline" className="ml-2 rounded-sm">
                  <Flex gap="1" align="center">
                    <Text>{t('trainAssist.notCompleted')}</Text>
                  </Flex>
                </Badge>
              )}
            </Flex>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {/* Left Panel - Step Guide */}
        <div className="flex w-3/5 flex-col overflow-hidden rounded-lg bg-white shadow">
          {/* Progress Steps */}
          <div className="flex border-b">
            {/* Learn Tab */}
            <div
              className={`flex items-center gap-2 p-4 ${
                view === 'topic' ? 'bg-iris-9 text-white' : 'bg-white text-gray-800'
              } w-1/3 cursor-pointer ${
                view !== 'topic' ? 'hover:bg-iris-4 hover:text-iris-11' : 'hover:bg-iris-10'
              } transition-colors`}
              onClick={handleTopicTabClick}
            >
              <div
                className={`rounded-full ${
                  view === 'topic' ? 'bg-white text-iris-9' : 'bg-gray-200 text-gray-600'
                } p-1`}
              >
                <BookOpen className="h-4 w-4" />
              </div>
              <span>{t('trainAssist.learn')}</span>
            </div>

            {/* Quiz Tab */}
            <div
              className={`flex items-center gap-2 p-4 ${
                view === 'quiz-intro' || view === 'quiz' || view === 'quiz-results'
                  ? 'bg-iris-9 text-white'
                  : 'bg-white text-gray-800'
              } w-1/3 ${isQuizTabEnabled ? 'cursor-pointer' : 'cursor-not-allowed'} ${
                isQuizTabEnabled &&
                view !== 'quiz-intro' &&
                view !== 'quiz' &&
                view !== 'quiz-results'
                  ? 'hover:bg-iris-4 hover:text-iris-11'
                  : view === 'quiz-intro' || view === 'quiz' || view === 'quiz-results'
                    ? 'hover:bg-iris-10'
                    : 'hover:bg-white'
              } transition-colors`}
              onClick={isQuizTabEnabled ? handleQuizTabClick : undefined}
            >
              <div
                className={`rounded-full ${
                  view === 'quiz-intro' || view === 'quiz' || view === 'quiz-results'
                    ? 'bg-white text-iris-9'
                    : 'bg-gray-200 text-gray-600'
                } p-1`}
              >
                <CheckCircle className="h-4 w-4" />
              </div>
              <span>{t('trainAssist.quiz')}</span>
            </div>

            {/* Simulation Tab */}
            <div
              className={`flex items-center gap-2 p-4 ${
                view === 'simulation' ? 'bg-iris-9 text-white' : 'bg-white text-gray-800'
              } w-1/3 cursor-pointer ${
                view !== 'simulation' ? 'hover:bg-iris-4 hover:text-iris-11' : 'hover:bg-iris-10'
              } transition-colors`}
              onClick={handleSimulationClick}
            >
              <div
                className={`rounded-full ${
                  view === 'simulation' ? 'bg-white text-iris-9' : 'bg-gray-200 text-gray-600'
                } p-1`}
              >
                <CheckCircle className="h-4 w-4" />
              </div>
              <span>{t('trainAssist.simulation')}</span>
            </div>
          </div>

          {/* Content Area - Conditionally render Topic or Quiz Tab */}
          {loading ? (
            <div className="p-6">
              <p>{t('trainAssist.loadingTopicContent')}</p>
            </div>
          ) : error ? (
            <div className="p-6">
              <p className="text-red-500">{error}</p>
            </div>
          ) : view === 'topic' ? (
            /* Topic Content - Using the new ContentTab component */
            <ContentTab
              topic={topic}
              lessonSectionRef={lessonSectionRef}
              currentModule={currentModule}
              handleQuizSelection={handleQuizSelection}
              handleDocumentClick={handleDocumentClick}
              handleNextStep={handleNextStep}
              handleStepClick={handleStepClick}
              handlePreviousStep={handlePreviousStep}
              isTopicCompleted={isTopicCompleted}
              loadingDocumentId={loadingDocumentId}
            />
          ) : view === 'simulation' ? (
            <SimulationTab 
              id={topicId} 
              onStartSimulation={handleStartSimulation} 
              config={config}
            />
          ) : (
            /* Quiz Tab - Using the new component */
            <QuizTab
              topicId={topicId}
              topic={topic}
              lessonSectionRef={lessonSectionRef}
              setIsTopicCompleted={setIsTopicCompleted}
              handleProceedToSimulation={handleProceedToSimulation}
              handleTopicTabClick={handleTopicTabClick}
              view={view}
              setView={setView}
              quizResults={quizResults}
              setQuizResults={setQuizResults}
            />
          )}
        </div>

        {/* Right Panel - AI Assist */}
        <div className="h-full w-2/5">
          {showChat && (
            <ChatAssist
              view={view}
              topic={topic}
              currentModule={currentModule}
              quizResults={quizResults}
              chatInput={chatInput}
              setChatInput={setChatInput}
              simulationSessionId={simulationSessionId}
              initialSimMessage={initialSimMessage}
              className="flex-1"
              isDisabled={view === 'quiz'}
              onRefresh={onRefreshChat}
              showEndChat={view === 'simulation'}
            />
          )}
        </div>
      </div>
    </div>
  );
}
