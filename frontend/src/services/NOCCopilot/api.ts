import { ChatAppRequest } from 'api/chat';
import { aiAgentInstance } from 'api/common/axiosInstance';
import { transformRequestV1 } from './requestTransformer';

export async function NOCChatApi(
  msgs: { content: string; role: string }[],
  question: string,
  selectedItemId: string,
  org_id: string,
  version = 'v1',
): Promise<any> {
  const endpoint = `/api/${version}/chat/noc_chat_assist`;

  // Transform request based on version
  let request: ChatAppRequest;
  if (version === 'v1') {
    request = transformRequestV1(msgs, question, selectedItemId, org_id);
  } else {
    throw new Error('Version not implemented');
  }

  const response = await aiAgentInstance.post(endpoint, request);

  if (response.status !== 200) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.data;
}
