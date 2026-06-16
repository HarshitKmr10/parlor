export type ChatProps = {
  chatId?: string;
  employee_id?: string;
  messages?: [string, ChatAppResponse][];
  employeeName?: string;
  phoneNumber?: string;
  email?: string;
  setEmployeeId?: (id: string) => void;
};

export type Chat = {
  created_at: string;
  id: string;
  meeting_id: string;
  message: string;
  role: string;
};

export const enum RetrievalMode {
  Hybrid = 'hybrid',
  Vectors = 'vectors',
  Text = 'text',
}

export const enum GPT4VInput {
  TextAndImages = 'textAndImages',
  Images = 'images',
  Texts = 'texts',
}

export const enum VectorFieldOptions {
  Embedding = 'embedding',
  ImageEmbedding = 'imageEmbedding',
  Both = 'both',
}

export type ChatAppRequestOverrides = {
  session_title?: string | null;
  retrieval_mode?: RetrievalMode;
  semantic_ranker?: boolean;
  semantic_captions?: boolean;
  exclude_category?: string;
  top?: number;
  temperature?: number;
  prompt_template?: string;
  prompt_template_prefix?: string;
  prompt_template_suffix?: string;
  suggest_followup_questions?: boolean;
  use_oid_security_filter?: boolean;
  use_groups_security_filter?: boolean;
  use_gpt4v?: boolean;
  gpt4v_input?: GPT4VInput;
  vector_fields: VectorFieldOptions[];
  call_transcript?: string;
  meeting_id?: string;
  app_id?: string;
  category?: string;
  module?: string;
  chat_type?: string;
  kb?: string;
  session_id?: string;
  ticket_id?: string;
};

export type ResponseMessage = {
  content: string;
  role: string;
};

export type Thoughts = {
  title: string;
  description: any; // It can be any output from the api
  props?: { [key: string]: string };
};

export type ResponseContext = {
  data_points: string[];
  followup_questions: string[] | null;
  citations: string[] | null;
  thoughts: Thoughts[];
  session_id?: string;
};

export type ResponseChoice = {
  index: number;
  message: ResponseMessage;
  context: ResponseContext;
  session_state: any;
};

export type ChatAppResponseOrError = {
  choices?: ResponseChoice[];
  error?: string;
};

interface ResponseMessageContent {
  user?: string;
  assistant: string;
}

interface Citation {
  name: string;
  url: string;
  source: string;
}

type ChatFormFieldText = {
  field_name: string;
  display_name: string;
  type: 'text';
  value: string;
  visible: boolean;
};

type ChatFormFieldDropdown = {
  field_name: string;
  display_name: string;
  visible: boolean;
  type: 'dropdown';
  value: {
    sys_id?: string;
    value?: string;
    name: string;
  }[];
};

export type ChatFormField = ChatFormFieldText | ChatFormFieldDropdown;

export interface SuggestedAction {
  action_id: string;
  display_name: string;
  description: string;
  requires_confirmation: boolean;
}

interface ResponseAids {
  citations?: Citation[];
  follow_up_questions?: any[];
  session_title?: string;
  optimized_questions_so_far?: string[];
  duplicate_question_identified?: boolean;
  escalate_to_human?: boolean;
  quick_replies?: string[];
  message_id?: string;
  nudge_incident_creation?: {
    status: boolean;
    data?: Record<string, string>;
    incident_fields?: ChatFormField[];
  };
  most_common_resolver_group?: {
    most_common_resolver_group: string;
  };
  incident_categories?: string[];
  user_email?: string;
  suggested_actions?: SuggestedAction[];
  relevant_tickets_sources?: any[];
  rag_response?: boolean;
  relevant_tickets_count?: number;
  similar_ticket_analytics?: Record<string, any>;
  predicted_assignment_group?: string;
}

interface User {
  employee_id?: string;
  employee_name?: string;
  email?: string;
  phone_number?: string;
  total_storage?: string;
  free_storage?: string;
  percentage_available?: string;
  operating_system?: string;
  existing_apps_by_name?: string;
}

interface Data {
  response_message_content: ResponseMessageContent;
  response_aids: ResponseAids;
  user_data?: User;
}

export interface ChatAppResponse {
  error?: any;
  data?: Data;
  meta?: any;
}
export type ChatAppRequestContext = {
  overrides?: ChatAppRequestOverrides;
};

export type ChatAppRequest = {
  messages: ResponseMessage[];
  context?: ChatAppRequestContext;
  stream?: boolean;
  org_id?: string;
  user?: {
    employee_id: string;
    employee_name: string;
    email: string;
    phone_number: string;
  };
};

export type Config = {
  showGPT4VOptions: boolean;
};

export interface TableData {
  id: string;
  created_at: string;
  agent_assist_id: string;
  message: string;
  employee_id: string | null;
  title: string | null;
  org_id: string | null;
}

export type HistoryChat = {
  id: string;
  message: string;
  employeeId: string | null;
  date: string;
};
