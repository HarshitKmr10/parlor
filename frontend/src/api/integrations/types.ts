
export interface OrgIntegration {
    id: string;
    created_at: string;
    updated_at: string;
    org_id: string;
    provider: string;
    integration_type: string;
    config: Record<string, string>;
    vault?: string;
    key?: string;
}

export interface IntegrationPayload {
   id?: string;
   integration_type: string;
   provider: string;
   config: Record<string, string | number>;
   secrets?: Record<string, string | number>;
}