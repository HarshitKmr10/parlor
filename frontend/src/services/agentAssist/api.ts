import { ChatAppRequest, ChatAppResponse } from 'api/chat';
import { transformRequestV1, transformRequestV2, transformRequestV3 } from './requestTransformer';
import { aiAgentInstance } from 'api/common/axiosInstance';
import { chatApiStream, isStreamingSupported, StreamingCallbacks } from './streamingApi';

// Re-export streaming utilities
export { chatApiStream, isStreamingSupported, type StreamingCallbacks } from './streamingApi';

async function retryWithDelay<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  delayMs = 2000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
        throw error; // Don't retry client errors
      }

      if (attempt === maxRetries) {
        break;
      }

      console.warn(`API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delayMs}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError!;
}

export async function chatApi(
  msgs: { content: string; role: string }[],
  question: string,
  employee_id: string | null,
  currentChatId: string,
  org_id: string,
  version = 'v1',
  agent_id: string,
): Promise<any> {
  // Transform request based on version
  let request: ChatAppRequest;
  if (version === 'v1') {
    request = transformRequestV1(msgs, question, employee_id, currentChatId, org_id);
  } else if (version === 'v2') {
    request = transformRequestV2(msgs, question, employee_id, currentChatId, org_id, agent_id);
  } else if (version === 'v3' || version === 'v4') {
    // v4 uses same request format as v3 - backend handles routing internally
    request = transformRequestV3(msgs, question, employee_id, currentChatId, org_id);
  } else {
    throw new Error('Version not implemented');
  }

  return await retryWithDelay(async () => {
    // v4 uses v3 endpoint - backend factory handles routing internally
    const apiVersion = version === 'v4' ? 'v3' : version;
    const response = await aiAgentInstance.post(`/api/${apiVersion}/chat/assist`, request, {
      timeout: 180000,
    });

    if (response.status !== 200) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    if (!response.data) {
      throw new Error('No response');
    }

    return response.data;
  }, 2, 3000);
}

export async function relevantTicketRetrievalApi(
  user_query: string,
  session_id: string,
  user_id: string,
  org_id?: string,
): Promise<any> {
  const requestBody = {
    user_query,
    org_id,
    session_id,
    user_id,
  };

  return await retryWithDelay(async () => {
    const response = await aiAgentInstance.post('/api/v1/relevant_ticket_retrieval', requestBody, {
      timeout: 60000,
    });

    if (response.status !== 200) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    if (!response.data) {
      throw new Error('No response');
    }

    return response.data;
  }, 2, 2000);
}

// ============ Nexthink Action APIs ============

export interface ActionPrepareRequest {
  action_id: string;
  employee_id: string;
  org_id: string;
  session_id: string;
}

export interface DeviceInfo {
  device_name: string;
  device_id: string;
  os_type: string;
  user_name: string;
}

export interface ActionPrepareResponse {
  success: boolean;
  action_id: string;
  action_name: string;
  action_description: string;
  requires_confirmation: boolean;
  device: DeviceInfo | null;
  error?: string;
}

export interface ActionExecuteRequest {
  action_id: string;
  device_id: string;
  org_id: string;
  session_id: string;
}

export interface ActionExecuteResponse {
  success: boolean;
  request_id: string | null;
  status: string;
  message: string;
  estimated_time_seconds: number;
  details?: Record<string, any>;
}

export interface ActionCancelRequest {
  session_id: string;
  org_id: string;
}

export interface ActionStatusRequest {
  request_id: string;
  org_id: string;
  session_id: string;
}

/**
 * Prepare a Nexthink action for execution.
 * Called when user selects an action from suggested actions.
 */
export async function prepareAction(request: ActionPrepareRequest): Promise<ActionPrepareResponse> {
  const response = await aiAgentInstance.post('/api/v3/action/prepare', request, {
    timeout: 30000,
  });

  if (response.status !== 200) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.data;
}

/**
 * Execute a confirmed Nexthink action.
 * Called when user confirms the action after seeing device details.
 * Returns immediately - use getActionStatus to poll for completion.
 */
export async function executeAction(request: ActionExecuteRequest): Promise<ActionExecuteResponse> {
  const response = await aiAgentInstance.post('/api/v3/action/execute', request, {
    timeout: 30000, // 30 seconds - execute returns immediately now
  });

  if (response.status !== 200) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.data;
}

/**
 * Check the status of an executing Nexthink action.
 * Called by frontend to poll for action completion.
 */
export async function getActionStatus(request: ActionStatusRequest): Promise<ActionExecuteResponse> {
  const response = await aiAgentInstance.post('/api/v3/action/status', request, {
    timeout: 15000, // 15 seconds - status check should be fast
  });

  if (response.status !== 200) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.data;
}

/**
 * Cancel a pending action and return to normal chat flow.
 */
export async function cancelAction(request: ActionCancelRequest): Promise<{ success: boolean; message: string }> {
  const response = await aiAgentInstance.post('/api/v3/action/cancel', request, {
    timeout: 10000,
  });

  if (response.status !== 200) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.data;
}

// ============ Smart Chat API (with optional streaming) ============

export interface ChatApiOptions {
  /** Enable streaming responses (default: true for v3+) */
  enableStreaming?: boolean;
  /** Callbacks for streaming events */
  streamingCallbacks?: StreamingCallbacks;
  /** Force non-streaming even if supported */
  forceNonStreaming?: boolean;
}

/**
 * Smart chat API that automatically uses streaming when available.
 *
 * For v3+ APIs, this will use SSE streaming by default, which provides:
 * - Near-instant first token (perceived latency ~100ms vs ~2-3s)
 * - Real-time response updates
 * - Better UX for longer responses
 *
 * @param msgs - Previous conversation messages
 * @param question - Current user question
 * @param employee_id - Employee ID (optional)
 * @param currentChatId - Session/chat ID
 * @param org_id - Organization ID
 * @param version - API version (v1, v2, v3, v4)
 * @param agent_id - Agent ID
 * @param options - Additional options including streaming callbacks
 */
export async function chatApiSmart(
  msgs: { content: string; role: string }[],
  question: string,
  employee_id: string | null,
  currentChatId: string,
  org_id: string,
  version = 'v1',
  agent_id: string,
  options: ChatApiOptions = {},
): Promise<ChatAppResponse> {
  const {
    enableStreaming = true,
    streamingCallbacks = {},
    forceNonStreaming = false,
  } = options;

  // Use streaming for v3+ if enabled and supported
  const shouldStream =
    !forceNonStreaming &&
    enableStreaming &&
    (version === 'v3' || version === 'v4') &&
    isStreamingSupported();

  if (shouldStream) {
    console.log('[chatApiSmart] Attempting streaming request to /api/v3/chat/assist/stream');
    try {
      return await chatApiStream(
        msgs,
        question,
        employee_id,
        currentChatId,
        org_id,
        streamingCallbacks,
      );
    } catch (streamError) {
      console.error('[chatApiSmart] Streaming failed, falling back to non-streaming:', streamError);
      // Fall through to non-streaming
    }
  } else {
    console.log('[chatApiSmart] Streaming not used:', {
      forceNonStreaming,
      enableStreaming,
      version,
      isSupported: isStreamingSupported(),
    });
  }

  // Use non-streaming API
  return await chatApi(
    msgs,
    question,
    employee_id,
    currentChatId,
    org_id,
    version,
    agent_id,
  );
}
