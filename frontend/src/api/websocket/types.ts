export interface WebSocketTokenResponse {
  success: boolean;
  message: string;
  data: {
    access_token: string;
  };
}
