'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, X, Check, Clock } from 'lucide-react';
import { Button, Box, Text, Flex, RadioGroup } from '@radix-ui/themes';
import { useGlobalContext } from '../../../../contexts/store';
import {
  generateTrainAssistQuiz,
  checkQuizAnswers,
  QuizResponse,
  TrainAssistTopic,
} from '../../../../api/trainAssist';
import { serviceDeskInstance } from '../../../../api/common/axiosInstance';

interface QuizTabProps {
  topicId: string;
  topic: TrainAssistTopic | null;
  lessonSectionRef: React.RefObject<HTMLDivElement>;
  setIsTopicCompleted: (isCompleted: boolean) => void;
  handleProceedToSimulation: () => void;
  handleTopicTabClick: () => void;
  view: 'quiz-intro' | 'quiz' | 'quiz-results';
  setView: (view: 'topic' | 'quiz-intro' | 'quiz' | 'quiz-results') => void;
  quizResults: {
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
  setQuizResults: React.Dispatch<
    React.SetStateAction<{
      score: number;
      correct_count: number;
      total_questions: number;
      feedback: Array<{
        question_index: number;
        is_correct: boolean;
        correct_answer: number;
        explanation: string;
      }>;
    } | null>
  >;
}

export default function QuizTab({
  topicId,
  topic,
  lessonSectionRef,
  setIsTopicCompleted,
  handleProceedToSimulation,
  handleTopicTabClick,
  view,
  setView,
  quizResults,
  setQuizResults,
}: QuizTabProps) {
  const { organization } = useGlobalContext();

  // Get passing score and cooloff period from configuration
  const config = useMemo(() => {
    return organization?.config ? JSON.parse(organization.config) : {};
  }, [organization?.config]);

  const passingScore = useMemo(() => {
    return config?.Modules?.train_assist?.features?.passing_score ?? 70;
  }, [config]);

  const cooloffPeriod = useMemo(() => {
    return config?.Modules?.train_assist?.quiz_cooloff_period ?? 0; // Default: 168 hours (1 week)
  }, [config]);

  // Quiz state
  const [currentQuizQuestion, setCurrentQuizQuestion] = useState(1);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizData, setQuizData] = useState<QuizResponse | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Quiz eligibility state
  const [quizEligibility, setQuizEligibility] = useState<{
    eligible: boolean;
    cooloff_period_hours: number;
    last_attempt_date: string | null;
    next_eligible_date: string | null;
    reason: string;
  } | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  // Check quiz eligibility when component mounts or topicId changes
  useEffect(() => {
    if (topicId && view === 'quiz-intro' && cooloffPeriod > 0) {
      checkQuizEligibility();
    } else if (topicId && view === 'quiz-intro' && cooloffPeriod === 0) {
      // If no cooloff period, user is always eligible
      setQuizEligibility({
        eligible: true,
        cooloff_period_hours: 0,
        last_attempt_date: null,
        next_eligible_date: null,
        reason: 'No cooloff period configured',
      });
    }
  }, [topicId, view, cooloffPeriod]);

  const checkQuizEligibility = async () => {
    if (!topicId) return;
    if (!cooloffPeriod || cooloffPeriod === 0) return;

    setEligibilityLoading(true);
    try {
      const response = await serviceDeskInstance.get(
        `/service_desk/train_assist_topic/${topicId}/quiz-eligibility?cooloff_hours=${cooloffPeriod}`,
      );
      setQuizEligibility(response.data);
    } catch (error) {
      console.error('Error checking quiz eligibility:', error);
      // If eligibility check fails, assume user is eligible
      setQuizEligibility({
        eligible: true,
        cooloff_period_hours: cooloffPeriod,
        last_attempt_date: null,
        next_eligible_date: null,
        reason: 'Eligibility check failed, assuming eligible',
      });
    } finally {
      setEligibilityLoading(false);
    }
  };

  const handleStartQuiz = async () => {
    if (!topicId) {
      setQuizError('No topic ID provided');
      return;
    }

    // Check eligibility before starting quiz
    if (quizEligibility && !quizEligibility.eligible) {
      setQuizError(
        'You are not eligible to take this quiz yet. Please wait until the cooloff period expires.',
      );
      return;
    }

    setQuizLoading(true);
    setQuizError(null);

    try {
      const quizResponse = await generateTrainAssistQuiz(topicId, 8); // Generate 8 questions
      setQuizData(quizResponse);
      setView('quiz');
      setCurrentQuizQuestion(1); // Start from the first question
      setSelectedAnswers({}); // Reset any previously selected answers
      // Scroll lesson section to top when starting the quiz
      if (lessonSectionRef.current) {
        lessonSectionRef.current.scrollTop = 0;
      }
      setQuizLoading(false);
    } catch (err) {
      console.error('Error generating quiz:', err);
      setQuizError('Failed to generate quiz. Please try again later.');
      setQuizLoading(false);
    }
  };

  const handleAnswerSelection = (questionId: number, optionIndex: number) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [questionId]: optionIndex,
    });
  };

  const handleRetryQuiz = () => {
    // Reset quiz state and go back to quiz
    setSelectedAnswers({});
    setCurrentQuizQuestion(1);
    setQuizResults(null);
    setView('quiz-intro');
    // Scroll lesson section to top when retrying the quiz
    if (lessonSectionRef.current) {
      lessonSectionRef.current.scrollTop = 0;
    }
  };

  // Calculate quiz score percentage
  const calculateScorePercentage = () => {
    if (!quizResults || !quizResults.total_questions) return 0;
    return (quizResults.correct_count / quizResults.total_questions) * 100;
  };

  // Check if quiz is passed (score >= passingScore%)
  const isQuizPassed = () => {
    return calculateScorePercentage() >= passingScore;
  };

  const allQuestionsAnswered = () => {
    if (!quizData || !quizData.quiz || !quizData.quiz.questions) return false;
    return quizData.quiz.questions.length === Object.keys(selectedAnswers).length;
  };

  const handleSubmitQuiz = async () => {
    if (!quizData || !quizData.quiz_id) {
      setQuizError('Quiz data not available');
      return;
    }

    setSubmitLoading(true);

    try {
      // Convert selectedAnswers object to array format expected by API
      const answersArray = Object.values(selectedAnswers) as number[];

      // Call the checkQuizAnswers API
      const results = await checkQuizAnswers(quizData.quiz_id, answersArray);

      // Store the results using the prop setter
      setQuizResults(results.data);

      // Check if quiz is passed and update completion status
      if (results.data.score >= passingScore) {
        setIsTopicCompleted(true);
      }

      // Switch to results view
      setView('quiz-results');
      setSubmitLoading(false);
    } catch (err) {
      console.error('Error submitting quiz:', err);
      setQuizError('Failed to submit quiz. Please try again.');
      setSubmitLoading(false);
    }
  };

  const handleNextQuestion = () => {
    if (quizData && quizData.quiz && quizData.quiz.questions) {
      if (currentQuizQuestion < quizData.quiz.questions.length) {
        setCurrentQuizQuestion(currentQuizQuestion + 1);
      }
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuizQuestion > 1) {
      setCurrentQuizQuestion(currentQuizQuestion - 1);
    }
  };

  if (view === 'quiz-intro') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-6">
        <div className="max-w-lg text-center">
          <h2 className="mb-4 text-2xl font-bold">Quiz: {topic?.title || 'Topic'}</h2>

          {/* Quiz Eligibility Status - Cool-off Period Box */}
          {eligibilityLoading ? (
            <div className="mb-6 rounded-lg bg-blue-50 p-4 text-left">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <Text className="text-blue-800">Checking quiz eligibility...</Text>
              </div>
            </div>
          ) : quizEligibility ? (
            !quizEligibility.eligible ? (
              quizEligibility?.reason && (quizEligibility?.reason?.toLowerCase().includes('maximum attempts') || quizEligibility?.reason?.toLowerCase().includes('max attempts') || quizEligibility?.reason?.toLowerCase().includes('attempt limit')) ? (
                <div className="mb-6 rounded-lg bg-amber-50 p-4 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    ⏳
                    <Text className="text-amber-800 font-medium">Max Quiz Attempts Reached</Text>
                  </div>
                  <Text size={"3"} className=" text-amber-700 mb-1">
                  • You have reached the maximum allowed attempts for this quiz.
                  </Text>
                  <br/>
                  <Text size={"3"} className=" text-amber-700 mb-1">
                  • Further attempts are currently not available.
                  </Text>
                  <br/>
                  <Text size={"3"} className="text-amber-700 mb-1">
                  • Please contact your admin.
                  </Text>
                </div>
              ) : (
                <div className="mb-6 rounded-lg bg-amber-50 p-4 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <Text className="text-amber-800 font-medium">Quiz on Cool-off Period</Text>
                  </div>
                  
                  {quizEligibility?.next_eligible_date ? (
                    <Text className="text-sm text-amber-700 mb-1">
                      Next Attempt Available: <span className="font-bold">{new Date(quizEligibility?.next_eligible_date).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}</span>
                    </Text>
                  ) : null}
                  <br/>
                  <Text className="text-sm text-amber-700 mb-1">
                    Cooloff period: <span className="font-bold">{quizEligibility?.cooloff_period_hours} hours</span>
                  </Text>
                  <br/>
                  <Text className="text-sm text-amber-700">
                    Please review the Learning module again in mean time
                  </Text>
                </div>
              )
            ) : null
          ) : null}

          {/* Quiz Details Box */}
          <div className="mb-6 rounded-lg bg-blue-50 p-4 text-left">
            <h3 className="mb-2 font-medium text-blue-800">Quiz Details:</h3>
            <ul className="space-y-2 text-blue-700">
              <li className="flex">
                <span className="mr-2">•</span>
                <span>Questions are about {topic?.title || 'this topic'} procedures.</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2">•</span>
                <span>Passing score: <span className="font-bold">{passingScore}%</span></span>
              </li>
              {!!cooloffPeriod && cooloffPeriod > 0 && (
                <li className="flex items-center">
                  <span className="mr-2">•</span>
                  <span>
                    {quizEligibility?.reason && (quizEligibility?.reason?.toLowerCase().includes('maximum attempts') || quizEligibility?.reason?.toLowerCase().includes('max attempts') || quizEligibility?.reason?.toLowerCase().includes('attempt limit')) 
                    ? quizEligibility?.reason
                    : (
                      <>
                        <span className="font-bold">Please note:</span> All attempts trigger a <span className="font-bold">{cooloffPeriod}-hour wait period</span> before a retake is allowed.
                      </>
                    )}
                  </span>
                </li>
              )}
            </ul>
          </div>

          {!!quizError && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-left">
              <p className="text-red-600">{quizError}</p>
            </div>
          )}

          <div className="flex justify-center">
            <Button
              onClick={handleStartQuiz}
              variant="solid"
              size="3"
              disabled={quizLoading || (cooloffPeriod > 0 && !quizEligibility?.eligible) || eligibilityLoading}
              style={{ gap: '8px' }}
            >
              {quizLoading ? (
                <>
                  <Loader2 className="mr-[-2px] h-5 w-5 animate-spin" />
                  Generating Quiz...
                </>
              ) : cooloffPeriod > 0 && !quizEligibility?.eligible ? (
                <>
                  <Clock className="mr-[-2px] h-5 w-5" />
                  Quiz Not Available
                </>
              ) : (
                <>
                  Start Quiz <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  } else if (view === 'quiz-results') {
    const scorePercentage = Math.round(calculateScorePercentage());
    const passed = isQuizPassed();

    return (
      <div className="overflow-auto p-6">
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-bold">Quiz Results</h2>
          <Box className="mb-5 text-center">
            <Box as="div" className="mb-2 flex flex-col items-center">
              {/* Container for the layered circles */}
              <Box as="div" className="relative mb-4 h-[100px] w-[100px]">
                {/* Outer circle (100px) */}
                <Box
                  as="div"
                  className={`absolute h-full w-full rounded-full ${
                    passed ? 'bg-green-100' : 'bg-red-100'
                  }`}
                />
                {/* Middle circle (83.4px) */}
                <Box
                  as="div"
                  className={`absolute left-1/2 top-1/2 h-[83.4px] w-[83.4px] -translate-x-1/2 -translate-y-1/2 rounded-full ${
                    passed ? 'bg-green-200' : 'bg-red-200'
                  }`}
                />
                {/* Inner circle (66.84px) with the icon */}
                <Box
                  as="div"
                  className={`absolute left-1/2 top-1/2 flex h-[66.84px] w-[66.84px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ${
                    passed ? 'bg-green-600' : 'bg-red-600'
                  }`}
                >
                  {passed ? (
                    <Check className="h-8 w-8 text-white" />
                  ) : (
                    <X className="h-8 w-8 text-white" />
                  )}
                </Box>
              </Box>

              {/* Text below the icon */}
              <Text
                as="p"
                className={`text-base font-medium ${passed ? 'text-green-600' : 'text-red-600'}`}
              >
                {passed ? 'Congratulations!' : 'Not Quite There'}
              </Text>
            </Box>
            <Box className="mb-2 flex justify-center">
              <Text className="text-sm font-normal text-coolGrey-900">
                Score: {quizResults?.correct_count}/{quizResults?.total_questions} (
                {scorePercentage}
                %)
              </Text>
            </Box>

            <Box className="mx-auto mb-2 h-2 w-full max-w-[333px] rounded-full bg-iris-3">
              <Box
                className={`h-2 rounded-full bg-iris-9`}
                style={{ width: `${scorePercentage}%` }}
              />
            </Box>

            <Text className="mb-8 text-gray-800">
              {passed
                ? 'Great job! You have successfully completed this topic.'
                : `You need to score at least ${passingScore}% to pass. Please try again.`}
            </Text>
          </Box>

          <Box className="mb-11 flex justify-center gap-2">
            <Button
              className="gap-0.5 rounded-md"
              variant="solid"
              color="iris"
              onClick={passed ? handleProceedToSimulation : handleRetryQuiz}
            >
              {passed ? `Proceed` : `Retry Quiz`} <ArrowRight className="h-4 w-4" />
            </Button>
          </Box>

          {config["Modules"]?.train_assist?.show_quiz_answers !== false && (
            <div className="mb-8 grid gap-4">
              <h3 className="mb-1 text-xl font-medium">Detailed Results</h3>
              {quizResults?.feedback.map((item, index) => {
                return (
                  <Flex
                    key={index}
                    className={`flex-col gap-4 rounded-lg border border-gray-300 bg-white p-4`}
                  >
                    <Text className="text-black text-base font-normal">
                      {index + 1}. {quizData?.quiz?.questions[item.question_index]?.question || ''}
                    </Text>

                    {!item.is_correct && (
                      <Flex className="flex h-auto w-full items-center gap-2 rounded-md border border-red-400 bg-red-100 px-4 py-2">
                        <Box className="flex h-4 w-4 items-center justify-center rounded-full border border-red-500 bg-white">
                          <Box className="h-2 w-2 rounded-full bg-red-500" />
                        </Box>

                        <Text className="text-sm font-normal text-red-700">
                          {
                            quizData?.quiz?.questions[item.question_index]?.options[
                              selectedAnswers[index + 1]
                            ]
                          }
                        </Text>
                      </Flex>
                    )}

                    {/* always show correct answer */}
                    <Flex className="flex h-auto w-full items-center gap-2 rounded-md border border-green-400 bg-green-100 px-4 py-2">
                      <Box className="flex h-4 w-4 items-center justify-center rounded-full border border-green-500 bg-white">
                        <Box className="h-2 w-2 rounded-full bg-green-500" />
                      </Box>

                      <Text className="text-sm font-normal text-green-700">
                        {quizData?.quiz?.questions[item.question_index]?.options[item.correct_answer]}
                      </Text>
                    </Flex>

                    {/* Add explanation if available - use the explanation from quizData for all questions */}
                    {quizData &&
                      quizData.quiz &&
                      quizData.quiz.questions &&
                      Boolean(quizData.quiz.questions[item.question_index]?.explanation) && (
                        <Box className="bg-iris-300 h-auto w-full gap-2  rounded-md px-4 py-2 bg-iris-3">
                          <Text className="text-base font-bold text-iris-9">Explanation: <br/></Text>
                          <Text className="text-base font-normal text-iris-9">
                            {`"${quizData.quiz.questions[item.question_index].explanation}"`}
                          </Text>
                        </Box>
                      )}
                  </Flex>
                );})}
            </div>
          )}
        </div>
      </div>
    );
  } else {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        {quizLoading ? (
          <div className="flex h-full flex-col items-center justify-center">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-iris-9" />
            <p>Generating quiz questions...</p>
          </div>
        ) : quizError ? (
          <div className="rounded-lg bg-red-50 p-4">
            <p className="text-red-600">{quizError}</p>
            <Button onClick={() => setView('quiz-intro')} variant="ghost" className="mt-4">
              Back to Quiz Intro
            </Button>
          </div>
        ) : quizData &&
          quizData.quiz &&
          quizData.quiz.questions &&
          quizData.quiz.questions.length > 0 ? (
          <>
            <Box className="flex-1 overflow-y-auto p-6">
              <h2 className="mb-6 text-lg font-medium">
                {currentQuizQuestion}. {quizData.quiz.questions[currentQuizQuestion - 1].question}
              </h2>

              <div className="space-y-4">
                {quizData.quiz.questions[currentQuizQuestion - 1].options.map((option, index) => (
                  <div
                    key={index}
                    className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                      selectedAnswers[currentQuizQuestion] === index
                        ? 'border-iris-5 bg-iris-3'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => handleAnswerSelection(currentQuizQuestion, index)}
                  >
                    <div className="flex items-center">
                      <div
                        className={`mr-3 flex h-6 w-6 items-center justify-center rounded-full ${
                          selectedAnswers[currentQuizQuestion] === index
                            ? 'bg-iris-9 text-white'
                            : 'border border-gray-300 bg-white'
                        }`}
                      >
                        {selectedAnswers[currentQuizQuestion] === index && (
                          <div className="h-3 w-3 rounded-full bg-white"></div>
                        )}
                      </div>
                      <span>{option}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Box>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t p-4">
              <Button
                onClick={handlePreviousQuestion}
                variant="ghost"
                disabled={currentQuizQuestion === 1}
                className="shrink-0"
              >
                <ArrowLeft className="mr-1 h-4 w-4" /> Previous
              </Button>

              <div className="flex min-w-0 flex-1 overflow-x-auto px-8">
                {quizData && quizData.quiz && quizData.quiz.questions ? (
                  <div className="m-auto flex gap-2">
                    {Array.from({ length: quizData.quiz.questions.length }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentQuizQuestion(i + 1)}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          currentQuizQuestion === i + 1
                            ? 'bg-iris-9 text-white'
                            : Object.keys(selectedAnswers).includes((i + 1).toString())
                              ? 'bg-iris-3 text-iris-9'
                              : 'text-gray-500'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div></div> /* Empty div when no quiz data */
                )}
              </div>

              {quizData &&
              quizData.quiz &&
              quizData.quiz.questions &&
              currentQuizQuestion === quizData.quiz.questions.length ? (
                <Button
                  onClick={handleSubmitQuiz}
                  variant="solid"
                  color="iris"
                  disabled={!allQuestionsAnswered() || submitLoading}
                  className="shrink-0"
                >
                  {submitLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit Quiz <CheckCircle className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleNextQuestion}
                  variant="solid"
                  disabled={
                    quizData && quizData.quiz && quizData.quiz.questions
                      ? selectedAnswers[currentQuizQuestion] === undefined
                      : true
                  }
                  className="shrink-0"
                >
                  Next <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center">
            <p>No quiz questions available. Please try again.</p>
            <Button onClick={() => setView('quiz-intro')} variant="ghost" className="mt-4">
              Back to Quiz Intro
            </Button>
          </div>
        )}
      </div>
    );
  }
}
