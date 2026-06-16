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

export async function KnowledgeCopilotApi(
  accessToken: string, // TODO: remove this from the function
  msgs: { content: string; role: string }[],
  meetingId: string,
  org_id: string,
  version = 'v1',
): Promise<any> {
  const endpoint = `/api/${version}/knowledge/copilot`;
  // Transform request based on version
  let request;
  if (version === 'v1') {
    request = transformSuggestionsRequestV1(msgs, meetingId, org_id);
  } else if (version === 'v2') {
    request = transformSuggestionsRequestV2(msgs, meetingId, org_id);
  }
  const response = await aiAgentInstance.post(endpoint, request);

  if (response.status !== 200) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.data;
}

export async function chatKnowledgeCopilotAssistApi(
  msgs: { content: string; role: string }[],
  question: string,
  transcript: string,
  meetingId: string,
  org_id: string,
  reformatTranscript: (transcript: string) => string,
  userDetails: UserDetails,
  version = 'v1',
): Promise<any> {
  let endpoint;
  if (version === 'v1') {
    endpoint = `/api/${version}/chat/copilot-chat-assist`;
  } else if (version === 'v2') {
    endpoint = `/api/${version}/chat/knowledge-assist`;
  } else {
    throw new Error('Version not implemented');
  }

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

export async function chatKnowledgePostcallAssistApi(
  msgs: { content: string; role: string }[],
  question: string,
  transcript: string,
  meetingId: string,
  org_id: string,
  reformatTranscript: (transcript: string) => string,
  userDetails: UserDetails,
  version = 'v1',
): Promise<any> {
  let endpoint;
  if (version === 'v1') {
    endpoint = `/api/${version}/chat/copilot-chat-assist`;
  } else if (version === 'v2') {
    endpoint = `/api/${version}/chat/knowledge-assist`;
  } else {
    throw new Error('Version not implemented');
  }

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
