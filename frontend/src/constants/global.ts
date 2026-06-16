// Define types for better type safety
export type ModuleKey =
  | 'train_assist'
  | 'knowledge_assist'
  | 'p1'
  | 'voice_p1_bridge'
  | 'observability'
  | 'expert_copilot'
  | 'agent_assist'
  | 'voice_copilot'
  | 'noc_copilot'
  | 'voice_virtual_agent'
  | 'anomaly_detection'
  | 'chat_virtual_agent'
  | 'ticketing_virtual_agent'
  | 'home'
  | 'default';

export interface ModuleConfig {
  [key: string]: {
    enabled: boolean;
  };
}

// Mapping of module identifiers to their corresponding routes
export const MODULE_ROUTES: Record<ModuleKey, string> = {
  train_assist: '/train-assist',
  knowledge_assist: '/knowledge/dashboard',
  p1: '/p1/logs',
  voice_p1_bridge: '/p1/logs',
  observability: '/observability',
  expert_copilot: '/expert-copilot',
  agent_assist: '/agent-assist',
  voice_copilot: '/calls',
  noc_copilot: '/noc-copilot',
  voice_virtual_agent: '/voice-virtual-agent',
  anomaly_detection: '/observability',
  chat_virtual_agent: '/chat-virtual-agent',
  ticketing_virtual_agent: '/tva-dashboard',
  home: '/home',
  default: '/profile',
};