import { serviceDeskInstance } from "api/common/axiosInstance";
import { IntegrationPayload, OrgIntegration } from "./types";

export const getIntegrations = async () => {
    return serviceDeskInstance.get<{ data: OrgIntegration[] }>('/integrations/list');
};

export const createOrUpdateIntegrations = async (payload: IntegrationPayload) => {
    return serviceDeskInstance.post<{ data: OrgIntegration }>('/integrations', payload);
};