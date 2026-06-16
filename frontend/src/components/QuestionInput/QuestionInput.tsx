// QuestionInput.tsx

import React, { useState, useCallback, useMemo } from 'react';
import {
  Badge, Button, Flex, IconButton, TextField,
} from '@radix-ui/themes';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import { escapeHtml } from 'utils/escapeHtml';

export interface QuestionInputProps {
  onSend: (question: string) => void;
  isStreaming?: boolean;
  isLoading?: boolean;
  clearOnSend?: boolean;
  followUpQuestions?: string[];
  onFollowupQuestionClicked?: (question: string) => void;
  showFollowUpQuestions?: boolean;
  quickReplies?: string[]
}

export function QuestionInput({
  onSend,
  isLoading = false,
  isStreaming = false,
  clearOnSend = false,
  followUpQuestions = [],
  onFollowupQuestionClicked,
  showFollowUpQuestions = true,
  quickReplies = [],
}: QuestionInputProps) {
  const [question, setQuestion] = useState<string>('');

  const handleInputSend = useCallback((question: string) => {
    onSend(escapeHtml(question));
  }, [question, isLoading, isStreaming, onSend]);

  const sendQuestion = useCallback(() => {
    const trimmedQuestion = question.trim();
    if (isLoading || isStreaming || !trimmedQuestion) {
      return;
    }

    try {
      handleInputSend(trimmedQuestion);
      if (clearOnSend) {
        setQuestion('');
      }
    } catch (error) {
      console.error('Error sending question:', error);
    }
  }, [question, isLoading, isStreaming, clearOnSend, handleInputSend]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendQuestion();
    }
  }, [sendQuestion]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuestion(e.target.value);
  }, []);

  // Memoize the disabled state to prevent unnecessary re-renders
  const isDisabled = useMemo(
    () => isLoading || isStreaming || question.length === 0,
    [isLoading, isStreaming, question],
  );

  return (
    <Flex bottom="0" direction="column" className="sticky mt-auto w-full">
      {showFollowUpQuestions && followUpQuestions.length > 0 && !isLoading && (
        <Flex
          wrap="wrap"
          gap="2"
          my="2"
          ml="3"
          mb="-2"
          align="center"
          justify="start"
        >
          {followUpQuestions.map((q, index) => (
            <Badge
              key={`${q}-${index}`} // Use combination of question and index for unique key
              size="1"
              variant="surface"
              className="cursor-pointer"
              onClick={() => onFollowupQuestionClicked && onFollowupQuestionClicked(q)}
            >
              {q}
            </Badge>
          ))}
        </Flex>
      )}
      {!!quickReplies?.length && (
        <Flex justify="end" mt="2" mb="-2" px="4" wrap="nowrap" gap="2" className="overflow-x-auto hidden sm:block">
          <Flex wrap="nowrap" gap="2">
            {quickReplies.map((reply) => (
              <Button
                key={reply}
                radius="medium"
                size="1"
                className="bg-iris-2 text-iris-9 active:bg-iris-4 hover:bg-iris-3 cursor-pointer"
                onClick={() => handleInputSend(reply)}
              >{reply}</Button>
            ))}
          </Flex>
        </Flex>
      )}
      <Flex align="center" justify="center" gapX="4" p="4">
        <TextField.Root
          size="2"
          placeholder="Enter your question here..."
          className="flex-grow"
          id="messageInput"
          autoComplete='off'
          value={question}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
        <IconButton
          variant="classic"
          disabled={isDisabled}
          onClick={sendQuestion}
          aria-label="Send question"
        >
          <ArrowRightIcon width="18" height="18" />
        </IconButton>
      </Flex>
    </Flex>
  );
}
