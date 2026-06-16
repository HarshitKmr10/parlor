import { aiAgentInstance } from 'api/common/axiosInstance';

/** Request payload to start a simulation */
export interface StartSimulationRequest {
  theme_id: string;
}

/** Response received after starting a simulation session */
export interface StartSimulationResponse {
  simulation_session_id: string;
  initial_customer_message: string;
  time_limit_seconds: number;
}

/**
 * Starts a new simulation session for a given theme.
 * @param theme_id ID of the simulation theme
 * @returns Simulation session data
 */
export const startSimulation = async (
  theme_id: string
): Promise<StartSimulationResponse> => {
  try {
    const response = await aiAgentInstance.post<StartSimulationResponse>(
      `/api/v2/train-assist/simulations/start`,
      { theme_id }
    );
    return response.data;
  } catch (error: any) {
    console.error("Failed to start simulation:", error);
    throw new Error(error?.response?.data?.detail || "Failed to start simulation");
  }
};

/** Request body for sending an agent message */
export interface SendMessageRequest {
  agent_message: string;
}

/** Response received from the simulation after sending a message */
export interface SendMessageResponse {
  customer_response: string;
  is_resolved: boolean;
  timed_out: boolean;
  time_remaining_seconds: number;
  error?: string;
  should_conversation_end?: boolean;
}

/**
 * Sends a message to the simulation session from the agent.
 * @param simulation_session_id The simulation session ID
 * @param agent_message The agent's message
 * @returns Response from the simulated customer
 */
export const sendSimulationMessage = async (
  simulation_session_id: string,
  agent_message: string
): Promise<SendMessageResponse> => {
  try {
    const response = await aiAgentInstance.post<SendMessageResponse>(
      `/api/v2/train-assist/simulations/${simulation_session_id}/send-message`,
      { agent_message }
    );
    return response.data;
  } catch (error: any) {
    console.error("Failed to send simulation message:", error);
    throw new Error(error?.response?.data?.detail || "Failed to send message to simulation");
  }
};

export interface ConcludeSimulationResponse {
  simulation_session_id: string;
  status: string;
  score?: number;
  feedback?: string;
  agent_feedback?: string;
  evaluation_details?: Record<string, any>;
  error?: string;
}

/**
 * Concludes an active simulation session.
 * @param simulation_session_id The session ID to conclude
 * @returns Conclude simulation response including score and feedback
 */
export const concludeSimulationSession = async (
  simulation_session_id: string
): Promise<ConcludeSimulationResponse> => {
  try {
    const response = await aiAgentInstance.post<ConcludeSimulationResponse>(
      `/api/v2/train-assist/simulations/${simulation_session_id}/conclude`
    );
    return response.data;
  } catch (error: any) {
    console.error("Failed to conclude simulation:", error);
    throw new Error(error?.response?.data?.detail || "Failed to conclude simulation");
  }
};