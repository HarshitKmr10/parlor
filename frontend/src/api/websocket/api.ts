
import { WebSocketTokenResponse } from './types';
import { serviceDeskInstance } from 'api/common/axiosInstance';

export async function getWebSocketToken(token: string): Promise<WebSocketTokenResponse> {
  const response = await serviceDeskInstance.get('/websocket/token');
  return response.data;
}
