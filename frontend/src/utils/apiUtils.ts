export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export async function fetchData(
  url: string,
  method: HttpMethod,
  body?: unknown,
): Promise<any> {
  try {
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
      body:
        ['POST', 'PUT', 'PATCH'].includes(method) && body
          ? JSON.stringify(body)
          : undefined,
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new HttpError(
        response.status,
        `HTTP error! Status: ${response.status}`,
      );
    }

    return (await response.json());
  } catch (error) {
    console.error('API Error:', error);

    throw error;
  }
}

export function parseMessage(chatMessage) {
  if (!chatMessage || typeof chatMessage.message !== 'string') {
    const error = new Error('Invalid chat message format');
    console.error('Message Parsing Error:', error);
    throw error;
  }
  try {
    return JSON.parse(chatMessage.message);
  } catch (error) {
    console.error('Message Parsing Error:', error);
    throw error;
  }
}
