// ─────────────────────────────────────────────────────────────
// API Infrastructure
// ─────────────────────────────────────────────────────────────
import { nocApiInstance, serviceNowInstance } from "api/common/axiosInstance";

// ─────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────

// ─── Agent Types ────────────────────────────────────────────
export interface Agent {
  id: string;
  name: string;
  type: 'predefined' | 'custom';
  prompt?: string;
  capabilities?: string[];
}

// ─── ChatRoom Types ─────────────────────────────────────────
export interface ChatRoom {
  id: string;
  name: string;
  session_id: string;
  agents: Agent[];
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent' | 'system';
  sender_id?: string;
  timestamp: string;
  metadata?: Record<string, any>;
  chat_available: boolean;
}

export interface ChatRoomWithMessages extends ChatRoom {
  messages: Message[];
  incident_details?: Record<string, any>;
  subchat_id?: string;
}

// ─── AgenticApp Types ──────────────────────────────────────
export interface AgenticApp {
  id: string;
  name: string;
  description: string;
  org_id: string;
  config: {
    agents: {
      type: 'predefined' | 'custom';
      agentName: string;
      agentPrompt?: string;
    };
    integrations: string[] | Record<string, any>;
    knowledgeSources: unknown[];
  };
  created_at: string;
  updated_at: string;
  appRoles: string[];
}

// ─── ServiceNow Types ──────────────────────────────────────
export interface ServiceNowWebhookPayload {
  sys_id: string;
  short_description: string;
  description: string;
  caller_id: string;
  severity: string;
  status: string;
  urgency: string;
  impact: string;
  correlation_id: string;
}

// ─── Analysis Types ─────────────────────────────────────────
export interface IncidentAnalysis {
  past_incident_details: any;
  change_requests: any;
  impact_analysis: string;
}

// ─── Infrastructure Types ──────────────────────────────────
export interface McpServer {
  id: string;
  name: string;
  url: string;
  status: 'active' | 'inactive';
  capabilities?: string[];
}

export interface KnowledgeSource {
  id: string;
  name: string;
  type: string;
  description?: string;
  status: 'active' | 'inactive';
}

// ─────────────────────────────────────────────────────────────
// Error Handling Utilities
// ─────────────────────────────────────────────────────────────
class AppsInfraApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'AppsInfraApiError';
  }
}

const handleApiError = (error: any, context: string): never => {
  console.error(`AppsInfra API Error (${context}):`, error?.response?.data || error.message);
  
  const statusCode = error?.response?.status;
  const errorMessage = error?.response?.data?.message || `Failed to ${context}`;
  
  throw new AppsInfraApiError(errorMessage, statusCode, error);
};

// ─────────────────────────────────────────────────────────────
// ChatRoom APIs
// ─────────────────────────────────────────────────────────────

/**
 * Fetch all chat rooms for a session
 */
export async function getChatRooms(sessionId: string): Promise<ChatRoom[]> {
  try {
    const response = await nocApiInstance.get(`/api/v1/sessions/${sessionId}/subchats`);
    return response.data;
  } catch (error) {
    handleApiError(error, 'fetch chat rooms');
  }
}

/**
 * Get chat rooms by incident ID
 */
export async function getChatRoomsByIncident(
  appId: string,
  incidentId: string
): Promise<ChatRoomWithMessages> {
  try {
    const response = await nocApiInstance.get(
      `/api/v1/${appId}/subchats/load_messages_by_incident/${incidentId}`
    );
    return response.data;
  } catch (error) {
    handleApiError(error, 'fetch chat rooms by incident');
  }
}

/**
 * List session subchats with error handling
 */
export async function listSessionSubchats(sessionId: string): Promise<ChatRoom[]> {
  try {
    const response = await nocApiInstance.get(`/api/v1/sessions/${sessionId}/subchats`);
    
    if (!response?.data) {
      throw new Error('No data returned from subchats API');
    }
    
    return response.data;
  } catch (error) {
    console.error('Failed to fetch session subchats:', error);
    return []; // fallback to empty list
  }
}

/**
 * Get messages for a specific subchat
 */
export async function getSubchatMessages(
  sessionId: string,
  subChatId: string
): Promise<Message[]> {
  try {
    const response = await nocApiInstance.get(
      `/api/v1/sessions/${sessionId}/subchats/${subChatId}/messages`
    );
    
    if (!response?.data) {
      throw new Error('No data returned from subchat messages API');
    }
    
    return response.data;
  } catch (error) {
    console.error('Failed to fetch subchat messages:', error);
    return []; // fallback to empty list
  }
}

/**
 * Get messages for a chatroom
 */
export async function getChatroomMessages(subChatId: string): Promise<Message[]> {
  try {
    const response = await nocApiInstance.get(`/api/v1/subchats/${subChatId}/load_messages`);
    return response.data;
  } catch (error) {
    handleApiError(error, 'fetch chatroom messages');
  }
}

/**
 * Create a new chat room
 */
export async function createChatRoom(
  sessionId: string,
  name: string,
  agents: Agent[]
): Promise<ChatRoom> {
  try {
    const response = await nocApiInstance.post(`/api/v1/sessions/${sessionId}/subchats`, {
      name,
      agents
    });
    return response.data;
  } catch (error) {
    handleApiError(error, 'create chat room');
  }
}

/**
 * Delete a chat room
 */
export async function deleteChatRoom(chatroomId: string): Promise<void> {
  try {
    await nocApiInstance.delete(`/api/v1/subchats/${chatroomId}`);
  } catch (error) {
    handleApiError(error, 'delete chat room');
  }
}

// ─────────────────────────────────────────────────────────────
// Analysis APIs
// ─────────────────────────────────────────────────────────────

/**
 * Get incident analysis
 */
export async function getIncidentAnalysis(incidentId: string): Promise<IncidentAnalysis | null> {
  try {
    const response = await nocApiInstance.post(`/api/v1/incident/analysis/${incidentId}`);
    
    if (!response?.data) {
      throw new Error('No data returned from incident analysis API');
    }
    
    return response.data;
  } catch (error) {
    console.error('Failed to fetch incident analysis:', error);
    return null;
  }
}

/**
 * Get session analysis
 */
export async function getSessionAnalysis(sessionId: string): Promise<IncidentAnalysis | null> {
  try {
    const response = await nocApiInstance.post(`/api/v1/sessions/analysis/${sessionId}`);
    
    if (!response?.data) {
      throw new Error('No data returned from session analysis API');
    }
    
    return response.data;
  } catch (error) {
    console.error('Failed to fetch session analysis:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// AgenticApp APIs
// ─────────────────────────────────────────────────────────────

/**
 * Create a new agentic app
 */
export async function createAgenticApp(appData: Partial<AgenticApp>): Promise<AgenticApp> {
  try {
    const response = await nocApiInstance.post(`/api/v1/apps`, appData);
    return response.data;
  } catch (error) {
    handleApiError(error, 'create agentic app');
  }
}

/**
 * Get all agentic apps
 */
export async function getAgenticApps(): Promise<AgenticApp[]> {
  try {
    const response = await nocApiInstance.get(`/api/v1/apps`);
    return response.data;
  } catch (error) {
    handleApiError(error, 'fetch agentic apps');
  }
}

/**
 * Get a specific agentic app by ID
 */
export async function getAgenticApp(appId: string): Promise<AgenticApp> {
  try {
    const response = await nocApiInstance.get(`/api/v1/apps/${appId}`);
    return response.data;
  } catch (error) {
    handleApiError(error, 'fetch agentic app');
  }
}

/**
 * Update an agentic app
 */
export async function updateAgenticApp(
  appId: string,
  appData: Partial<AgenticApp>
): Promise<AgenticApp> {
  try {
    const response = await nocApiInstance.put(`/api/v1/apps/${appId}`, appData);
    return response.data;
  } catch (error) {
    handleApiError(error, 'update agentic app');
  }
}

/**
 * Delete an agentic app
 */
export async function deleteAgenticApp(appId: string): Promise<void> {
  try {
    await nocApiInstance.delete(`/api/v1/apps/${appId}`);
  } catch (error) {
    handleApiError(error, 'delete agentic app');
  }
}

// ─────────────────────────────────────────────────────────────
// Infrastructure APIs
// ─────────────────────────────────────────────────────────────

/**
 * Get MCP servers
 */
export async function getMcpServers(): Promise<McpServer[]> {
  try {
    const response = await nocApiInstance.get(`/api/v1/mcp_servers`);
    return response.data;
  } catch (error) {
    handleApiError(error, 'fetch MCP servers');
  }
}

/**
 * Get knowledge sources
 */
export async function getKnowledgeSources(): Promise<KnowledgeSource[]> {
  try {
    const response = await nocApiInstance.get(`/api/v1/kb_collections`);
    return response.data;
  } catch (error) {
    handleApiError(error, 'fetch knowledge sources');
  }
}

// ─────────────────────────────────────────────────────────────
// ServiceNow Integration APIs
// ─────────────────────────────────────────────────────────────

/**
 * Trigger ServiceNow webhook
 */
export async function triggerServiceNowWebhook(
  webhookId: string,
  payload: ServiceNowWebhookPayload
): Promise<any> {
  try {
    const response = await serviceNowInstance.post(
      `/api/v1/service_now/webhook/${webhookId}`,
      payload
    );
    return response.data;
  } catch (error: any) {
    console.error("Error triggering ServiceNow webhook:", error?.response?.data || error.message);
    throw new AppsInfraApiError(
      error?.response?.data?.message || "Failed to trigger ServiceNow webhook",
      error?.response?.status,
      error
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

/**
 * Check if an API response is successful
 */
export const isApiResponseSuccessful = (response: any): boolean => {
  return response && response.status >= 200 && response.status < 300;
};

/**
 * Extract error message from API response
 */
export const extractErrorMessage = (error: any): string => {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error?.message) {
    return error.message;
  }
  return 'An unknown error occurred';
};

/**
 * Retry function for API calls
 */
export const retryApiCall = async <T>(
  apiCall: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError;
};

// ─────────────────────────────────────────────────────────────
// Export AppsInfraApiError for external use
// ─────────────────────────────────────────────────────────────
export { AppsInfraApiError }; 