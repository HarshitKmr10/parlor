import { ChatAppRequest } from 'api/chat';
import { UserDetails } from 'types/common';
import {
  transformIntakeChatRequestV1,
  transformIntakeChatRequestV2,
  transformPostCallChatRequestV1,
  transformPostCallChatRequestV2,
  transformSuggestionsRequestV1,
  transformSuggestionsRequestV2,
} from './requestTransformer';
import { aiAgentInstance } from 'api/common/axiosInstance';

export async function VoiceCopilotApi(
  msgs: { content: string; role: string }[],
  meetingId: string,
  org_id: string,
  version = 'v1',
  employeeId?: string,
): Promise<any> {
  const endpoint = `/api/${version}/voice/copilot`;
  // Transform request based on version
  let request;
  if (version === 'v1') {
    request = transformSuggestionsRequestV1(msgs, meetingId, org_id);
  } else if (version === 'v2') {
    request = transformSuggestionsRequestV2(msgs, meetingId, org_id, employeeId);
  }
  const response = await aiAgentInstance.post(endpoint, request, { responseType: 'stream' });  

  if (response.status !== 200) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.data;
}

export async function chatCopilotAssistApi(
  msgs: { content: string; role: string }[],
  question: string,
  transcript: string,
  meetingId: string,
  org_id: string,
  reformatTranscript: (transcript: string) => string,
  userDetails: UserDetails,
  version = 'v1',
): Promise<any> {
  const endpoint = `/api/${version}/chat/copilot-chat-assist`;

  let request: ChatAppRequest;
  if (version === 'v1') {
    request = transformIntakeChatRequestV1(
      msgs,
      question,
      transcript,
      meetingId,
      org_id,
      reformatTranscript,
    );
  } else if (version === 'v2') {
    request = transformIntakeChatRequestV2(
      msgs,
      question,
      transcript,
      meetingId,
      org_id,
      reformatTranscript,
      userDetails,
    );
  } else {
    throw new Error('Version not implemented');
  }

  const response = await aiAgentInstance.post(endpoint, request); 

  if (response.status !== 200) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.data;
}

export async function chatPostcallAssistApi(
  msgs: { content: string; role: string }[],
  question: string,
  transcript: string,
  meetingId: string,
  org_id: string,
  reformatTranscript: (transcript: string) => string,
  userDetails: UserDetails,
  version = 'v1',
): Promise<any> {
  const endpoint = `/api/${version}/chat/copilot-chat-assist`;

  let request: ChatAppRequest;
  if (version === 'v1') {
    request = transformPostCallChatRequestV1(
      msgs,
      question,
      transcript,
      meetingId,
      org_id,
      reformatTranscript,
    );
  } else if (version === 'v2') {
    request = transformPostCallChatRequestV2(
      msgs,
      question,
      transcript,
      meetingId,
      org_id,
      reformatTranscript,
      userDetails,
    );
  } else {
    throw new Error('Version not implemented');
  }

  const response = await aiAgentInstance.post(endpoint, request);

  if (response.status !== 200) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.data;
}

export async function fetchTicketSuggestionsApi(
  msgs: { content: string; role: string }[],
  meetingId: string,
  org_id: string,
  aiResponse: string,
  previousIncidentsContext: string | null,
  vvaHandoverSummary: string | null,
  callTranscript: string | null,
  mostCommonResolverGroup: any,
  primaryCache: any,
  userDetails: { user_name?: string; employee_id?: string },
  version = 'v2',
): Promise<any> {
  const endpoint = `/api/${version}/voice/copilot/ticket-suggestions`;

  const request = {
    messages: msgs,
    session_variables: {
      user_name: userDetails.user_name || null,
      employee_id: userDetails.employee_id || null,
      org_id,
      session_id: meetingId,
      app_id: 'voice-copilot',
      vva_handover_summary: vvaHandoverSummary,
    },
    ai_response: aiResponse,
    previous_incidents_context: previousIncidentsContext,
    vva_handover_summary: vvaHandoverSummary,
    call_transcript: callTranscript,
    most_common_resolver_group: mostCommonResolverGroup,
    primary_cache: primaryCache,
  };

  const response = await aiAgentInstance.post(endpoint, request);

  if (response.status !== 200) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.data;
}
