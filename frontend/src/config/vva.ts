export const VVA_CONFIG = {
  // Current active version
  activeVersion: 'v3', // Can be 'v1', 'v2', or 'v3'
  
  // API endpoints for each version
  endpoints: {
    v1: '/voice-virtual-agent',
    v2: '/v2/voice-virtual-agent',
    v3: '/v3/voice-virtual-agent'
  },
  
  // Features available in each version
  features: {
    v1: {
      description: 'Basic VVA implementation',
      supports: ['basic_function_calls', 'ticket_creation', 'employee_verification']
    },
    v2: {
      description: 'VVA with RAG support',
      supports: ['basic_function_calls', 'ticket_creation', 'employee_verification', 'rag_support', 'conversation_history']
    },
    v3: {
      description: 'Advanced VVA with Entra ID support',
      supports: ['basic_function_calls', 'ticket_creation', 'employee_verification', 'rag_support', 'conversation_history', 'entra_id_verification', 'interaction_records', 'advanced_ticket_management']
    }
  }
};

// Helper function to get the current endpoint
export const getVVAApiEndpoint = (orgId: string) => {
  const baseEndpoint = VVA_CONFIG.endpoints[VVA_CONFIG.activeVersion];
  return `${baseEndpoint}/${orgId}`;
};

// Helper function to check if a feature is supported in the current version
export const isFeatureSupported = (feature: string) => {
  return VVA_CONFIG.features[VVA_CONFIG.activeVersion].supports.includes(feature);
}; 