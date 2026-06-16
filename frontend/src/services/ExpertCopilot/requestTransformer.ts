import { ChatAppRequest } from 'api/chat';
import { chatAppRequestContextSettings } from './config';

export function transformRequestV1(
  msgs: { content: string; role: string }[],
  question: string,
  selectedItemId: string,
  org_id: string,
): ChatAppRequest {
  return {
    messages: [...msgs, { content: question, role: 'user' }],
    stream: false,
    user: null,
    context: {
      overrides: {
        session_title: null,
        prompt_template:
          chatAppRequestContextSettings.promptTemplate.length === 0
            ? undefined
            : chatAppRequestContextSettings.promptTemplate,
        exclude_category:
          chatAppRequestContextSettings.excludeCategory.length === 0
            ? undefined
            : chatAppRequestContextSettings.excludeCategory,
        top: chatAppRequestContextSettings.retrieveCount,
        retrieval_mode: chatAppRequestContextSettings.retrievalMode,
        semantic_ranker: chatAppRequestContextSettings.useSemanticRanker,
        semantic_captions:
          chatAppRequestContextSettings.useSemanticCaptions,
        suggest_followup_questions:
          chatAppRequestContextSettings.suggestFollowupQuestions,
        use_oid_security_filter:
          chatAppRequestContextSettings.useOidSecurityFilter,
        use_groups_security_filter:
          chatAppRequestContextSettings.useGroupsSecurityFilter,
        vector_fields: chatAppRequestContextSettings.vectorFieldList,
        use_gpt4v: chatAppRequestContextSettings.useGPT4V,
        gpt4v_input: chatAppRequestContextSettings.gpt4vInput,
        session_id: selectedItemId,
        ticket_id: selectedItemId,
      },
    },
    org_id,
  };
}
