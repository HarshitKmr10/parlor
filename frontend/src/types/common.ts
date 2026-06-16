export type ApplicationsRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  linkedin: string;
  cvLink: string;
};
export type User = {
  name: string;
  profile_pic: string;
  email: string;
  date: string;
  teams: string[];
};

type MessageContent = {
  content: string;
};

// Define the type for the context of the message
type MessageContext = {
  followup_questions: string[];
  citations: string[];
};

// Define the type for the choice object in the choices array
type Choice = {
  message: MessageContent;
  context: MessageContext;
};

// Define the type for the message array in the AgentAssistMessageType
type AgentAssistMessageContent = [
  string,
  {
    choices: Choice[];
  },
];
export interface UserDetails {
  fullName: string;
  mobilePhone: string;
  email: string;
  employeeId: string;
  employeeNumber?: string;
  sys_id?: string;
}

export type AgentAssistMessageType = {
  id: number;
  created_at: string;
  agent_assist_id: string;
  message: AgentAssistMessageContent;
  employee_id: string | null;
  title: string | null;
  org_id: string | null;
};
export type UserType = {
  id?: string;
  name?: string;
  email?: string;
  org_id?: string;
  role?: string;
  profile_pic?: string;
  calendar?: string;
  access_token?: string;
  tag_lead?: any;
};

export type JobInfo = {
  id: string;
  company: string;
  title: string;
  // Include any other fields you want from the API response
};

export type UploadHistoryRow = {
  id: string;
  fileName: string;
  job: string;
  uploadStartedAt: string;
  timeTaken: string;
  jobCount: number;
  status: string;
  filesProcessed: number;
};

export type TeamType = {
  id: string;
  name: string;
  description: string;
  logo: string;
};
export type TeamPermissionsType = {
  id: string;
  created_at: string;
  user_id: string;
  team_id: string;
};

export type Organization = {
  created_at: string;
  name: string;
  description?: string;
  logo?: string;
  id: string;
  phone?: string;
  config: string;
};

type RagConfig = {
  top_k: number;
  collection_name: string;
};

type TicketingAuth = {
  username: string;
  password: string;
  instance_name: string;
};

type Feature = {
  enabled: boolean;
  service?: string;
};

type Features = {
  ticketingSystem?: Feature;
  endpointManagement?: Feature;
  phoneIntegration?: Feature;
  onlineIntegration?: Feature;
};
type LandingPageConfig = {
  header_message: string;
  example_questions: string[];
};

type ModuleConfig = {
  enabled: boolean;
  agents?: string[] | null;
  rag_config?: RagConfig | null;
  ticketing_service?: string | null;
  ticketing_auth?: TicketingAuth | null;
  features?: Features | null;
  knowledgebase_id?: string | null;
  landing_page_config?: LandingPageConfig | null;
  endpoint_auth?: string | null;
};

type Modules = {
  agent_assist?: ModuleConfig;
  voice_copilot?: ModuleConfig;
  noc_copilot?: ModuleConfig;
  voice_virtual_agent?: ModuleConfig;
  chat_virtual_agent?: ModuleConfig;
};

export type OrganizationConfig = {
  Name: string;
  Description: string;
  Modules: Modules;
};

export type Meeting = {
  id?: number;
  title?: string | null;
  start_timestamp?: string;
  analysis_status?: string; // Consider making this an enum if fixed values are used
  channel?: string | null;
  meeting_id?: string | null;
  end_timestamp?: string | null;
  app_id?: string | null;
  bot_name?: string | null;
  call_recording_url?: string | null;
  listener_id?: string | null;
  phone_number?: string | null;
  postcall_analysis?: string | null;
  postcall_analysis_webhook?: string | null;
  postcall_transcript?: string | null;
  link?: string | null;

  // Add any other fields that are needed for your table and are present in the data
};

export type P1Meeting = {
  id?: number;
  title?: string | null;
  start_timestamp?: string;
  analysis_status?: string; // Consider making this an enum if fixed values are used
  channel?: string | null;
  meeting_id?: string | null;
  end_timestamp?: string | null;
  app_id?: string | null;
  bot_name?: string | null;
  call_recording_url?: string | null;
  listener_id?: string | null;
  phone_number?: string | null;
  postcall_analysis?: string | null;
  postcall_analysis_webhook?: string | null;
  postcall_transcript?: string | null;
  link?: string | null;
  incident_number?: string | null;
};

export type SuggestionReaction = 'liked' | 'disliked' | null;

// TODO: use this type for scope in Answer component
// where is the answer being shown
export type AnswerScope = 'agent-assist' | 'copilot' | 'virtual-agent';

export interface ModalProps {
  isOpen: boolean;
  onRequestClose?: () => void;
}
export interface TeamModalProps extends ModalProps {
  onTeamChange?: () => void; // Callback to refresh teams after add/edit/delete
}

export type TimeFrameType = '7D' | '1M' | '3M' | 'CUSTOM';

// Add other shared types here as needed
