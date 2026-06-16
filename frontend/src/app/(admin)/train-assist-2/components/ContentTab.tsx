'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@radix-ui/themes';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { postTrainAssistModuleCompletion, TrainAssistTopic } from '../../../../api/trainAssist';
import "./styles.css";
import { useTranslation } from 'react-i18next';

// Markdown components for consistent rendering (matching ChatAssist styling)
const markdownComponents = {
  h1: ({ children }: { children: React.ReactNode }) => (
    <h1 className="text-2xl font-bold mt-6 mb-2">{children}</h1>
  ),
  h2: ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-xl font-bold mt-5 mb-2">{children}</h2>
  ),
  h3: ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-lg font-bold mt-4 mb-2">{children}</h3>
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
  p: ({ children }: { children: React.ReactNode }) => <p className="mb-3">{children}</p>,
  strong: ({ children }: { children: React.ReactNode }) => (
    <strong className="font-bold">{children}</strong>
  ),
  em: ({ children }: { children: React.ReactNode }) => <em className="italic">{children}</em>,
  code: ({ inline, className, children }: { inline?: boolean; className?: string; children: React.ReactNode }) => (inline ? (
    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">
      {children}
    </code>
  ) : (
    <code
      className={`block bg-gray-100 p-4 rounded-lg mb-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap break-words ${className || ''}`}
    >
      {children}
    </code>
  )),
  pre: ({ children }: { children: React.ReactNode }) => (
    <pre className="bg-gray-100 p-4 rounded-lg mb-4 overflow-x-auto text-sm">
      {children}
    </pre>
  ),
  ul: ({ children }: { children: React.ReactNode }) => (
    <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children: React.ReactNode }) => (
    <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>
  ),
  li: ({ children }: { children: React.ReactNode }) => <li className="mb-1">{children}</li>,
  blockquote: ({ children }: { children: React.ReactNode }) => (
    <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4 text-gray-600">
      {children}
    </blockquote>
  ),
  a: ({ href, children }: { href?: string; children: React.ReactNode }) => (
    <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }: { children: React.ReactNode }) => (
    <div className="overflow-x-auto mb-4">
      <table className="min-w-full border-collapse border border-gray-300">
        {children}
      </table>
    </div>
  ),
  th: ({ children }: { children: React.ReactNode }) => (
    <th className="border border-gray-300 px-4 py-2 bg-gray-100 font-semibold text-left">
      {children}
    </th>
  ),
  td: ({ children }: { children: React.ReactNode }) => (
    <td className="border border-gray-300 px-4 py-2">{children}</td>
  ),
  hr: () => <hr className="my-6 border-t border-gray-300" />,
};

interface ContentTabProps {
  topic: TrainAssistTopic | null;
  lessonSectionRef: React.RefObject<HTMLDivElement>;
  currentModule: number;
  handleQuizSelection: () => void;
  handleDocumentClick: (documentId: string) => void;
  handleNextStep: () => void;
  handlePreviousStep: () => void;
  handleStepClick: (index: number) => void;
  isTopicCompleted: boolean;
  loadingDocumentId?: string | null;
}

export default function ContentTab({
  topic,
  lessonSectionRef,
  currentModule,
  handleQuizSelection,
  handleDocumentClick,
  handleNextStep,
  handlePreviousStep,
  handleStepClick,
  isTopicCompleted,
  loadingDocumentId
}: ContentTabProps) {
  const { t } = useTranslation();
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  // Check if user has scrolled to bottom
  const checkScrollPosition = useCallback(() => {
    if (lessonSectionRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = lessonSectionRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px tolerance
      setHasScrolledToBottom(isAtBottom);
    }
  }, [lessonSectionRef]);

  // Add scroll event listener
  useEffect(() => {
    const contentElement = lessonSectionRef.current;
    if (contentElement) {
      contentElement.addEventListener('scroll', checkScrollPosition);
      // Check initial scroll position
      checkScrollPosition();
      
      return () => {
        contentElement.removeEventListener('scroll', checkScrollPosition);
      };
    }
  }, [checkScrollPosition, lessonSectionRef]);

  // Reset scroll state when module changes
  useEffect(() => {
    setHasScrolledToBottom(false);
  }, [currentModule]);

  // Check if content is short enough that no scrolling is needed
  useEffect(() => {
    if (lessonSectionRef.current) {
      const { scrollHeight, clientHeight } = lessonSectionRef.current;
      // If content height is less than or equal to container height, enable button
      if (scrollHeight <= clientHeight) {
        setHasScrolledToBottom(true);
      }
    }
  }, [topic, currentModule, lessonSectionRef]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6" ref={lessonSectionRef}>
        {topic && topic.details.modules && topic.details.modules.length > 0 ? (
          <>
            <div className="mb-4">
              <div className="max-w-none text-sm leading-relaxed text-gray-800">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {topic.details.modules[currentModule]?.content}
                </ReactMarkdown>
              </div>
            </div>

            <div className="mt-4 border-t pt-4">
              <h3 className="mb-2 font-medium">{t('trainAssist.references')}</h3>
              <div className="flex flex-wrap gap-3">
                {topic.details.modules[currentModule]?.document_references?.map((ref, index) => (
                  <div
                    key={index}
                    className="flex cursor-pointer items-center gap-1 rounded bg-iris-3 px-3 py-1 text-sm text-iris-9 hover:bg-iris-4"
                    onClick={() => handleDocumentClick(ref.id)}
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-iris-4 text-xs">
                      📄
                    </span>
                    {ref.name}
                    {loadingDocumentId === ref.id && (
                      <Loader2 className="w-3 h-3 ml-1 animate-spin" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p>{t('trainAssist.noModulesFound')}</p>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t p-4">
        <Button
          onClick={handlePreviousStep}
          variant="ghost"
          disabled={currentModule === 0}
          className="shrink-0"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> {t('trainAssist.previous')}
        </Button>

        <div className="flex min-w-0 flex-1 overflow-x-auto px-8">
          <div className="m-auto flex gap-2">
            {topic.details.modules.map((_, index) => (
              <div
                key={index}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  currentModule === index ? 'bg-iris-9 text-white' : 'text-gray-500'
                }`}
              >
                {index + 1}
              </div>
            ))}
          </div>
        </div>

        <Button
          onClick={
            ()=>{
              postTrainAssistModuleCompletion(topic.id, currentModule.toString());
              if(topic && topic.details.modules && currentModule === topic.details.modules.length - 1){
                handleQuizSelection();
              }else{
                handleNextStep();
              }
            }
          }
          variant="solid"
          disabled={!hasScrolledToBottom}
          className="shrink-0"
        >
          {topic && topic.details.modules && currentModule === topic.details.modules.length - 1 ? (
            <>
              {t('trainAssist.completeTopic')} <ArrowRight className="ml-1 h-4 w-4" />
            </>
          ) : (
            <>
              {t('trainAssist.next')} <ArrowRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
} 