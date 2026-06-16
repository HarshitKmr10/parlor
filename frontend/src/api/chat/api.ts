import { CONFIG } from "config";
import {
  ChatAppRequest,
} from "./models";
import { aiAgentInstance } from "api/common/axiosInstance";

export async function trainAssistChatApi(
  request: ChatAppRequest
) {
  return await aiAgentInstance.post(`/api/v1/chat/train-assist`, request);
}

export async function voiceP1BridgeCopilotApi(
  request: ChatAppRequest
) {
  return await aiAgentInstance.post(`/api/v1/voice/p1_bridge`, request);
}

export function getCitationFilePath(
  citation: string,
  org_id: string | null
) {
  return `${CONFIG.AI_AGENT_API_URL}/api/v1/get_file_content/${org_id}/${citation}`;
}

export async function getVVASummaryFilePath(caller_id: string) {
  return await aiAgentInstance.get(`/api/v1/get_vva_call_report/${caller_id}.json`);
}

export async function getIncidentFields({
  app_id,
  org_id,
  session_id,
  incident_data
}: {
  app_id: string,
  org_id: string,
  session_id: string,
  incident_data: Record<string, unknown>
}) {
  return await aiAgentInstance.post(`/api/v2/fetch/incident/fields`, {
    app_id: app_id,
    org_id: org_id,
    session_id: session_id,
    incident_data: incident_data
  }).then((response) => {
    return response.data;
  });
}

export async function createIncident({
  app_id,
  org_id,
  session_id,
  incident_data
}: {
  app_id: string,
  org_id: string,
  session_id: string,
  incident_data: Record<string, unknown>
}) {
  return await aiAgentInstance.post(`/api/v2/create/incident`, {
    app_id: app_id,
    org_id: org_id,
    session_id: session_id,
    incident_data: incident_data
  }).then((response) => {
    return response.data;
  });
}