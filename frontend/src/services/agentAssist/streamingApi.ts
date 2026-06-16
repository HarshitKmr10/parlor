/**
 * Streaming API for Agent Assist
 *
 * Provides Server-Sent Events (SSE) streaming support for real-time responses.
 * This significantly improves perceived latency by showing tokens as they arrive.
 */

import { transformRequestV3 } from './requestTransformer';
import { ChatAppResponse } from 'api/chat';

// Event types from the backend
export type StreamEventType =
  | 'status'
  | 'progress'
  | 'token'
  | 'content'
  | 'sources'
  | 'citations'
  | 'metadata'
  | 'done'
  | 'error';

export interface StreamEvent {
  type: StreamEventType;
  data: any;
  timestamp: number;
}

export interface StreamingCallbacks {
  onStatus?: (message: string, stage: string) => void;
  onProgress?: (current: number, total: number, details?: string) => void;
  onToken?: (token: string) => void;
  onCitations?: (citations: any[]) => void;
  onMetadata?: (metadata: any) => void;
  onDone?: (finalData: any) => void;
  onError?: (error: string) => void;
}

/**
 * Parse SSE event data from a string line
 */
function parseSSEEvent(line: string): StreamEvent | null {
  if (!line.startsWith('data: ')) {
    return null;
  }

  try {
    const jsonStr = line.slice(6); // Remove 'data: ' prefix
    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn('Failed to parse SSE event:', line, e);
    return null;
  }
}

/**
 * Streaming chat API that yields tokens as they arrive
 *
 * @param msgs - Previous conversation messages
 * @param question - Current user question
 * @param employee_id - Employee ID (optional)
 * @param currentChatId - Session/chat ID
 * @param org_id - Organization ID
 * @param callbacks - Callbacks for handling different event types
 * @returns Promise that resolves to the complete response when done
 */
export async function chatApiStream(
  msgs: { content: string; role: string }[],
  question: string,
  employee_id: string | null,
  currentChatId: string,
  org_id: string,
  callbacks: StreamingCallbacks = {},
): Promise<ChatAppResponse> {
  const request = transformRequestV3(msgs, question, employee_id, currentChatId, org_id);

  // Get auth token from localStorage (stored as ACCESS_TOKEN by axiosInstance)
  const token = localStorage.getItem('ACCESS_TOKEN');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const baseUrl = process.env.NEXT_PUBLIC_AI_AGENT_API_URL || '';
  const url = `${baseUrl}/api/v3/chat/assist/stream`;

  // Timing instrumentation
  const requestStartTime = performance.now();
  let firstByteTime: number | null = null;
  let firstTokenTime: number | null = null;
  let tokenCount = 0;
  let lastTokenTime: number | null = null;
  console.log('[STREAMING TIMING] Request started at:', new Date().toISOString());

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stream request failed: ${response.status} - ${errorText}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  // Accumulate the full response
  let fullResponse = '';
  let citations: any[] = [];
  let metadata: any = {};
  let finalData: any = {};

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Log final timing summary
        const totalTime = performance.now() - requestStartTime;
        console.log('[STREAMING TIMING] === FINAL SUMMARY ===');
        console.log(`[STREAMING TIMING] Total request time: ${totalTime.toFixed(0)}ms`);
        console.log(`[STREAMING TIMING] Time to first byte: ${firstByteTime ? (firstByteTime - requestStartTime).toFixed(0) : 'N/A'}ms`);
        console.log(`[STREAMING TIMING] Time to first token: ${firstTokenTime ? (firstTokenTime - requestStartTime).toFixed(0) : 'N/A'}ms`);
        console.log(`[STREAMING TIMING] Total tokens received: ${tokenCount}`);
        if (firstTokenTime && lastTokenTime) {
          const streamingDuration = lastTokenTime - firstTokenTime;
          console.log(`[STREAMING TIMING] Streaming duration (first to last token): ${streamingDuration.toFixed(0)}ms`);
          console.log(`[STREAMING TIMING] Avg time per token: ${tokenCount > 1 ? (streamingDuration / (tokenCount - 1)).toFixed(1) : 'N/A'}ms`);
        }
        break;
      }

      // Track first byte time
      if (firstByteTime === null) {
        firstByteTime = performance.now();
        console.log(`[STREAMING TIMING] First byte received: ${(firstByteTime - requestStartTime).toFixed(0)}ms after request`);
      }

      // Decode and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete events (separated by double newlines)
      const events = buffer.split('\n\n');
      buffer = events.pop() || ''; // Keep incomplete event in buffer

      for (const eventBlock of events) {
        if (!eventBlock.trim()) continue;

        // Parse each line in the event block
        const lines = eventBlock.split('\n');
        for (const line of lines) {
          const event = parseSSEEvent(line);
          if (!event) continue;

          switch (event.type) {
            case 'status':
              console.log(`[STREAMING TIMING] Status: "${event.data.stage}" - "${event.data.message}" at ${(performance.now() - requestStartTime).toFixed(0)}ms`);
              callbacks.onStatus?.(event.data.message, event.data.stage);
              break;

            case 'progress':
              callbacks.onProgress?.(
                event.data.current,
                event.data.total,
                event.data.collection || event.data.details,
              );
              break;

            case 'token':
            case 'content':
              // Track first token time
              if (firstTokenTime === null) {
                firstTokenTime = performance.now();
                console.log(`[STREAMING TIMING] ⚡ FIRST TOKEN received: ${(firstTokenTime - requestStartTime).toFixed(0)}ms after request`);
              }
              tokenCount++;
              lastTokenTime = performance.now();
              // Log every 10th token to avoid console spam
              if (tokenCount <= 5 || tokenCount % 20 === 0) {
                console.log(`[STREAMING TIMING] Token #${tokenCount}: "${event.data.substring(0, 20)}..." at ${(lastTokenTime - requestStartTime).toFixed(0)}ms`);
              }
              fullResponse += event.data;
              callbacks.onToken?.(event.data);
              break;

            case 'citations':
              citations = event.data;
              callbacks.onCitations?.(event.data);
              break;

            case 'sources':
              // Sources can also be used as citations
              if (!citations.length) {
                citations = event.data;
                callbacks.onCitations?.(event.data);
              }
              break;

            case 'metadata':
              metadata = event.data;
              callbacks.onMetadata?.(event.data);
              break;

            case 'done':
              finalData = event.data;
              callbacks.onDone?.(event.data);
              break;

            case 'error':
              callbacks.onError?.(event.data.error || 'Unknown streaming error');
              throw new Error(event.data.error || 'Streaming error');
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Construct the ChatAppResponse format from streamed data
  const chatResponse: ChatAppResponse = {
    error: null,
    data: {
      response_message_content: {
        user: question,
        assistant: fullResponse,
      },
      response_aids: {
        citations: citations,
        quick_replies: metadata.quick_replies || [],
        session_title: currentChatId,
        rag_response: metadata.rag_response ?? true,
        relevant_tickets_sources: metadata.relevant_tickets_sources || [],
        relevant_tickets_count: metadata.relevant_tickets_count || 0,
        similar_ticket_analytics: metadata.similar_ticket_analytics || {},
        most_common_resolver_group: metadata.most_common_resolver_group || {},
        predicted_assignment_group: metadata.predicted_assignment_group || '',
        incident_categories: metadata.incident_categories || [],
        user_email: metadata.user_email || '',
        suggested_actions: metadata.suggested_actions || [],
      },
      user_data: {
        employee_id: metadata.employee_sys_id || employee_id || '',
      },
    },
  };

  return chatResponse;
}

/**
 * Check if streaming is supported for the current browser/environment
 */
export function isStreamingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof ReadableStream !== 'undefined' &&
    typeof TextDecoder !== 'undefined'
  );
}

/**
 * Hook-friendly streaming function that returns an async generator
 */
export async function* streamChatResponse(
  msgs: { content: string; role: string }[],
  question: string,
  employee_id: string | null,
  currentChatId: string,
  org_id: string,
): AsyncGenerator<StreamEvent, ChatAppResponse, undefined> {
  const request = transformRequestV3(msgs, question, employee_id, currentChatId, org_id);

  const token = localStorage.getItem('ACCESS_TOKEN');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const baseUrl = process.env.NEXT_PUBLIC_AI_AGENT_API_URL || '';
  const url = `${baseUrl}/api/v3/chat/assist/stream`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Stream request failed: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  let fullResponse = '';
  let citations: any[] = [];
  let metadata: any = {};

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const eventBlock of events) {
        if (!eventBlock.trim()) continue;

        const lines = eventBlock.split('\n');
        for (const line of lines) {
          const event = parseSSEEvent(line);
          if (!event) continue;

          // Track accumulated data
          if (event.type === 'token' || event.type === 'content') {
            fullResponse += event.data;
          } else if (event.type === 'citations' || event.type === 'sources') {
            citations = event.data;
          } else if (event.type === 'metadata') {
            metadata = event.data;
          }

          yield event;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Return the complete response
  return {
    error: null,
    data: {
      response_message_content: {
        user: question,
        assistant: fullResponse,
      },
      response_aids: {
        citations,
        quick_replies: metadata.quick_replies || [],
        session_title: currentChatId,
        rag_response: metadata.rag_response ?? true,
        relevant_tickets_sources: metadata.relevant_tickets_sources || [],
        relevant_tickets_count: metadata.relevant_tickets_count || 0,
        similar_ticket_analytics: metadata.similar_ticket_analytics || {},
        most_common_resolver_group: metadata.most_common_resolver_group || {},
        predicted_assignment_group: metadata.predicted_assignment_group || '',
        incident_categories: metadata.incident_categories || [],
        user_email: metadata.user_email || '',
        suggested_actions: metadata.suggested_actions || [],
      },
      user_data: {
        employee_id: metadata.employee_sys_id || employee_id || '',
      },
    },
  };
}
