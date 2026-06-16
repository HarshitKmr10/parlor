import { useState, useCallback } from 'react';
import { ChatAppResponse, ResponseMessage } from 'api/chat/models';
import { API } from 'api';
import { reformatTranscript } from 'utils/stringUtils';
import { UserDetails } from 'types/common';
import { chatKnowledgePostcallAssistApi } from 'services/Knowledge/api';

interface UseApiRequestProps {
  meetingId: string;
  user: any;
  transcript: string;
  userDetails: UserDetails;
  version: string;
}

class PostCallChatApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostCallChatApiError';
  }
}

async function saveChatMessage(
  message: string,
  role: string,
  id: string, 
  messageId: string,
  user: any,
): Promise<void> {
  try {
    await API.Meetings.InsertChatMessage(id, message, role, messageId, user);
  } catch (err) {
    console.error('Error saving chat message:', err);
    throw new PostCallChatApiError(
      `Failed to save chat message: ${err instanceof Error ? err.message : 'Unknown error'}`,
    );
  }
}

export function useKnowledgePostCallChatApiRequest({
  meetingId,
  user,
  transcript,
  userDetails,
  version,
}: UseApiRequestProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const makeApiRequest = useCallback(
    async (question: string, prevAnswers: [string, ChatAppResponse][]) => {
      setIsLoading(true);
      setError(null);

      try {
        if (!meetingId) {
          return;
        }

        if (!user) {
          return;
        }

        const messages: ResponseMessage[] = prevAnswers.flatMap((a) => [
          { content: a[0], role: 'user' },
          {
            content: a[1].data.response_message_content.assistant,
            role: 'assistant',
          },
        ]);

        const response = await chatKnowledgePostcallAssistApi(
          messages,
          question,
          transcript,
          meetingId,
          user?.org_id,
          reformatTranscript,
          userDetails,
          version,
        );

        if (!response || !response.data || !response.data.response_message_content || !response.data.response_aids) {
          throw new PostCallChatApiError('Invalid response structure from API');
        }

        await saveChatMessage(
          JSON.stringify([
            question,
            {
              data: {
                response_message_content: {
                  assistant: response.data.response_message_content.assistant,
                },
                response_aids: {
                  citations: response.data.response_aids.citations,
                  follow_up_questions: [],
                },
              },
            },
          ]),
          'assistant',
          meetingId,
          response.data.response_aids.message_id,
          user,
        );

        return [question, response] as [string, ChatAppResponse];
      } catch (e) {
        console.error('Error making API request:', e);
        const err =
          e instanceof PostCallChatApiError
            ? e
            : new PostCallChatApiError(
                e instanceof Error ? e.message : 'An unknown error occurred',
              );
        setError(err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [meetingId, user, transcript],
  );

  return { makeApiRequest, isLoading, error };
}
