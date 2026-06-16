import { ChatAppRequest } from 'api/chat';
import { chatAppRequestContextSettings } from './config';
import { RetrievalMode, GPT4VInput, VectorFieldOptions } from 'api/chat/models';

export function transformRequestV1(
  msgs: { content: string; role: string }[],
  question: string,
  employee_id: string | null,
  currentChatId: string,
  org_id: string,
): ChatAppRequest {
  return {
    messages: [...msgs, { content: question, role: 'user' }],
    stream: false,
    user: employee_id
      ? {
        employee_id: employee_id?.length > 0 ? employee_id : null,
        employee_name: null,
        email: null,
        phone_number: null,
      }
      : null,
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
        semantic_captions: chatAppRequestContextSettings.useSemanticCaptions,
        suggest_followup_questions: chatAppRequestContextSettings.suggestFollowupQuestions,
        use_oid_security_filter: chatAppRequestContextSettings.useOidSecurityFilter,
        use_groups_security_filter: chatAppRequestContextSettings.useGroupsSecurityFilter,
        vector_fields: chatAppRequestContextSettings.vectorFieldList,
        use_gpt4v: chatAppRequestContextSettings.useGPT4V,
        gpt4v_input: chatAppRequestContextSettings.gpt4vInput,
        session_id: currentChatId,
        app_id: 'agent-assist',
      },
    },
    org_id,
  };
}

export function transformRequestV2(
  msgs: { content: string; role: string }[],
  question: string,
  employee_id: string | null,
  currentChatId: string,
  org_id: string,
  agent_id: string,
) {
  return {
    messages: [...msgs, { content: question, role: 'user' }],
    session_variables: {
      session_id: currentChatId,
      agent_id: agent_id,
      app_id: 'agent_assist',
      user_name: null,
      employee_id: employee_id || null,
      org_id,
    },
  };
}


export function transformRequestV3(
  msgs: { content: string; role: string }[],
  question: string,
  employee_id: string | null,
  currentChatId: string,
  org_id: string,
  options?: {
    employee_name?: string;
    email?: string;
    phone_number?: string;
    ticket_id?: string;
    call_transcript?: string;
    ticket_details?: Record<string, any>;
    category?: string;
    module?: string;
    chat_type?: string;
    kb?: string;
    app_id?: string;
  }
): ChatAppRequest {
  const {
    employee_name = '',
    email = '',
    phone_number = '',
    ticket_id = '',
    call_transcript = '',
    ticket_details = {},
    category = '',
    module = '',
    chat_type = '',
    kb = '',
    app_id = 'agent-assist',
  } = options || {};

  return {
    messages: [
      ...msgs.map((msg) => ({
        content: msg.content,
        role: msg.role,
        tool_call_id: null,
        tool_calls: null,
      })),
      { content: question, role: 'user', tool_call_id: null, tool_calls: null },
    ],
    stream: false,
    user: employee_id
      ? {
          employee_id: employee_id?.length > 0 ? employee_id : '',
          employee_name,
          email,
          phone_number,
        }
      : undefined,
    context: {
      overrides: {
        top: chatAppRequestContextSettings.retrieveCount ?? 7,
        retrieval_mode: chatAppRequestContextSettings.retrievalMode ?? RetrievalMode.Vectors,
        session_id: currentChatId,
        app_id,
        semantic_ranker: chatAppRequestContextSettings.useSemanticRanker ?? true,
        semantic_captions: chatAppRequestContextSettings.useSemanticCaptions ?? false,
        suggest_followup_questions: chatAppRequestContextSettings.suggestFollowupQuestions ?? false,
        use_oid_security_filter: chatAppRequestContextSettings.useOidSecurityFilter ?? false,
        use_groups_security_filter: chatAppRequestContextSettings.useGroupsSecurityFilter ?? false,
        vector_fields: chatAppRequestContextSettings.vectorFieldList ?? [VectorFieldOptions.Embedding],
        use_gpt4v: chatAppRequestContextSettings.useGPT4V ?? false,
        gpt4v_input: chatAppRequestContextSettings.gpt4vInput ?? GPT4VInput.Texts,
        ticket_id,
        call_transcript,
        category,
        module,
        chat_type,
        kb,
      },
    },
    org_id,
  };
}
