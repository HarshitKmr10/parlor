import { UserDetails } from 'types/common';
import { chatAppRequestContextSettings } from './config';

export function transformSuggestionsRequestV1(
  msgs: { content: string; role: string }[],
  meetingId: string,
  org_id: string,
) {
  return {
    messages: msgs,
    stream: false,
    context: {
      overrides: {
        top: 7,
        retrieval_mode: chatAppRequestContextSettings.retrievalMode,
        semantic_ranker: true,
        semantic_captions: false,
        suggest_followup_questions: false,
        use_oid_security_filter: false,
        use_groups_security_filter: false,
        vector_fields: chatAppRequestContextSettings.vectorFieldList,
        use_gpt4v: chatAppRequestContextSettings.useGPT4V,
        gpt4v_input: chatAppRequestContextSettings.gpt4vInput,
        meeting_id: meetingId,
        session_id: meetingId,
        app_id: 'voice-copilot',
      },
    },
    session_state: null,
    org_id,
    user: null,
    optimized_questions_so_far: null,
  };
}

export function transformSuggestionsRequestV2(
  msgs: { content: string; role: string }[],
  meetingId: string,
  org_id: string,
) {
  return {
    messages: msgs,
    session_variables: {
      session_id: meetingId,
      app_id: 'voice_copilot',
      user_name: null,
      employee_id: null,
      org_id,
    },
  };
}

export function transformIntakeChatRequestV1(
  msgs: { content: string; role: string }[],
  question: string,
  transcript: string,
  meetingId: string,
  org_id: string,
  reformatTranscript: (transcript: string) => string,
) {
  return {
    messages: [...msgs, { content: question, role: 'user' }],
    org_id,
    stream: true,
    context: {
      overrides: {
        prompt_template: undefined,
        exclude_category: '',
        top: 7,
        retrieval_mode: chatAppRequestContextSettings.retrievalMode,
        semantic_ranker: true,
        semantic_captions: false,
        suggest_followup_questions: true,
        use_oid_security_filter: false,
        use_groups_security_filter: false,
        vector_fields: chatAppRequestContextSettings.vectorFieldList,
        use_gpt4v: chatAppRequestContextSettings.useGPT4V,
        gpt4v_input: chatAppRequestContextSettings.gpt4vInput,
        call_transcript: transcript,
        meeting_id: meetingId,
        session_id: meetingId,
        app_id: 'voice-copilot-chatassist',
      },
    },
  };
}

export function transformIntakeChatRequestV2(
  msgs: { content: string; role: string }[],
  question: string,
  transcript: string,
  meetingId: string,
  org_id: string,
  reformatTranscript: (transcript: string) => string,
  userDetails: UserDetails,
) {

  return {
    messages: [...msgs, { content: question, role: 'user' }],
    session_variables: {
      session_id: meetingId,
      app_id: 'knowledge_assist',
      user_name: userDetails.fullName,
      employee_id: userDetails.employeeId,
      org_id,
      call_transcript: transcript,
    },
  };
}

export function transformPostCallChatRequestV1(
  msgs: { content: string; role: string }[],
  meetingId: string,
  transcript: string,
  question: string,
  org_id: string,
  reformatTranscript: (transcript: string) => string,
) {
  return {
    messages: [...msgs, { content: question, role: 'user' }],
    stream: true,
    org_id,
    context: {
      overrides: {
        prompt_template: undefined,
        exclude_category: '',
        top: 7,
        retrieval_mode: chatAppRequestContextSettings.retrievalMode,
        semantic_ranker: true,
        semantic_captions: false,
        suggest_followup_questions: true,
        use_oid_security_filter: false,
        use_groups_security_filter: false,
        vector_fields: chatAppRequestContextSettings.vectorFieldList,
        use_gpt4v: chatAppRequestContextSettings.useGPT4V,
        gpt4v_input: chatAppRequestContextSettings.gpt4vInput,
        call_transcript: reformatTranscript(transcript),
        meeting_id: meetingId,
        session_id: meetingId,
        app_id: 'voice-copilot-postcall-chatassist',
      },
    },
  };
}

export function transformPostCallChatRequestV2(
  msgs: { content: string; role: string }[],
  question: string,
  transcript: string,
  meetingId: string,
  org_id: string,
  reformatTranscript: (transcript: string) => string,
  userDetails: UserDetails,
) {
  return {
    messages: [...msgs, { content: question, role: 'user' }],
    session_variables: {
      session_id: meetingId,
      app_id: 'knowledge_assist',
      user_name: userDetails.fullName,
      employee_id: userDetails.employeeId,
      org_id,
      call_transcript: reformatTranscript(transcript),
    },
  };
}
