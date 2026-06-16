import { useState, useEffect, useCallback } from 'react';
import { useGlobalContext } from 'contexts/store';
import { Organization } from '@/types/common';

interface OrganizationConfig {
  ticketingEnabled?: boolean;
  ticketingSystem?: string;
  endpointManagement: boolean;
  endpointSystem: string;
  version_copilot?: string;
  version_assist?: string;
  version_knowledge?: string;
  useUserId?: boolean;
  agentAssistConfig: any;
  ticketIntegrationEnabled?: boolean;
}

class OrganizationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrganizationConfigError';
  }
}

export const useOrganizationConfig = () => {
  const { organization } = useGlobalContext();
  const [config, setConfig] = useState<OrganizationConfig>({
    ticketingEnabled: false,
    ticketingSystem: '',
    endpointManagement: false,
    endpointSystem: '',
    version_copilot: 'v1',
    version_assist: 'v1',
    useUserId: false,
    agentAssistConfig: null,
    ticketIntegrationEnabled: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const parseConfig = useCallback(() => {
    if (!organization) {
      return;
      // throw new OrganizationConfigError('Organization information is missing');
    }

    try {
      const parsedConfig = JSON.parse(organization.config);
      if (!parsedConfig.Modules || !parsedConfig.Modules.agent_assist) {
        throw new OrganizationConfigError('Invalid organization configuration structure');
      }

      const agentAssistConfig = parsedConfig.Modules.agent_assist;
      const voiceCopilotVersion = parsedConfig.Modules.voice_copilot?.version;
      const knowledgeAssistVersion = parsedConfig.Modules.knowledge_assist?.version;
      const agentAssistVersion = agentAssistConfig.version;
      const useUserId = parsedConfig.Modules.agent_assist?.use_user_id || false;
      
      // Check if ticket integration is enabled in voice_copilot features
      const ticketIntegrationEnabled = parsedConfig.Modules.voice_copilot?.features?.ticketIntegration?.enabled || false;

      return {
        ticketingEnabled: agentAssistConfig.enabled
          ? agentAssistConfig.features.ticketingSystem.enabled
          : false,
        ticketingSystem: agentAssistConfig.features.ticketingSystem.service,
        endpointManagement: agentAssistConfig.enabled
          ? agentAssistConfig.features.endpointManagement.enabled
          : false,
        endpointSystem: agentAssistConfig.features.endpointManagement.service,
        version_copilot: voiceCopilotVersion || 'v1',
        version_assist: agentAssistVersion || 'v1',
        version_knowledge: knowledgeAssistVersion || 'v1',
        useUserId: useUserId,
        agentAssistConfig: agentAssistConfig?.enabled ? agentAssistConfig : null,
        ticketIntegrationEnabled: ticketIntegrationEnabled
      };
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new OrganizationConfigError('Invalid JSON in organization configuration');
      }
      throw e;
    }
  }, [organization]);

  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      setError(null);

      try {
        const parsedConfig = parseConfig();
        setConfig(parsedConfig);
      } catch (err) {
        setConfig({
          ticketingEnabled: false,
          ticketingSystem: '',
          endpointManagement: false,
          endpointSystem: '',
          version_copilot: 'v1',
          version_assist: 'v1',
          useUserId: false,
          agentAssistConfig: null,
          ticketIntegrationEnabled: false,
        });
        // throw Error('Unknown error occurred while parsing configuration');
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [parseConfig]);

  return { config, loading, error };
};
