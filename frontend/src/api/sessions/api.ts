import { nocApiInstance } from 'api/common/axiosInstance';
import { Incident, Session } from './models';
import { v4 as uuidv4 } from 'uuid';


export async function getSessionsApi(appId: string): Promise<Session[]> {
   return await nocApiInstance.get(`/api/v1/sessions/apps/${appId}`).then((res) => res.data);
}

export async function getIncidentsApi(appId: string): Promise<Incident[]> {
  return await nocApiInstance.get(`/api/v1/incidents`).then((res) => res.data);
}

export async function getSessionByIdApi(sessionId: string): Promise<Session> {
  return await nocApiInstance.get(`/api/v1/sessions/${sessionId}`).then((res) => res.data);
}

export interface CreateSessionOptions {
  integrationIds?: string[];
  sessionOrigin?: string;
  sessionVisibility?: string;
  org_id?: string;
  user_id?: string;
  related_record_type?: string;
  related_record_id?: string;
  chat_available?: boolean;
}

export async function createSessionApi(
  name: string,
  session_type: string,
  app_id: string,
  options?: CreateSessionOptions
): Promise<Session> {
  return await nocApiInstance
    .post('/api/v1/sessions', {
      name,
      session_type,
      app_id,
      org_id: options?.org_id,
      user_id: options?.user_id,
      integration_ids: options?.integrationIds,
      sessionOrigin: options?.sessionOrigin ?? 'MANUAL',
      sessionVisibility: options?.sessionVisibility ?? 'PRIVATE',
      related_record_type: options?.related_record_type ?? 'incident',
      chat_available: options?.chat_available ?? true,
       ...(options?.related_record_id ? { related_record_id: options.related_record_id } : {})
    })
    .then((res) => res.data);
}

export async function updateSessionApi(sessionId: string, updates: Partial<Session>): Promise<Session> {
  return await nocApiInstance.patch(`/api/v1/sessions/${sessionId}`, updates).then((res) => res.data);
}

export async function deleteSessionApi(sessionId: string): Promise<void> {
  await nocApiInstance.delete(`/sessions/${sessionId}`).then((res) => res.data);
}

