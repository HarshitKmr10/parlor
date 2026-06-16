'use client';

import { PropsWithChildren, createContext, useContext, useState } from 'react';
import { StoreApi, createStore, useStore } from 'zustand';

interface TranscriptItem {
  content: string;
  timestamp: string;
  isPartial: boolean;
  userName: string;
}

type WebSocketStore = {
  // WebSocket connection state
  websocketText: TranscriptItem[];
  unformattedWebsocketText: string;
  websocket: WebSocket | null;
  error: Error | null;
  isConnected: boolean;
  
  // Actions
  setWebsocketText: (text: TranscriptItem[]) => void;
  setUnformattedWebsocketText: (text: string) => void;
  setWebsocket: (ws: WebSocket | null) => void;
  setError: (error: Error | null) => void;
  setIsConnected: (connected: boolean) => void;
  connect: (meetingId: string, meeting: any, userDetails: any) => void;
  disconnect: () => void;
  clearTranscript: () => void;
};

const WebSocketContext = createContext<StoreApi<WebSocketStore> | undefined>(undefined);

export const WebSocketProvider = ({ children }: PropsWithChildren) => {
  const [store] = useState(() =>
    createStore<WebSocketStore>((set, get) => ({
      // Initial state
      websocketText: [],
      unformattedWebsocketText: '',
      websocket: null,
      error: null,
      isConnected: false,
      
      // Actions
      setWebsocketText: (text) => set({ websocketText: text }),
      setUnformattedWebsocketText: (text) => set({ unformattedWebsocketText: text }),
      setWebsocket: (ws) => set({ websocket: ws }),
      setError: (error) => set({ error }),
      setIsConnected: (connected) => set({ isConnected: connected }),
      
      clearTranscript: () => set({ 
        websocketText: [], 
        unformattedWebsocketText: '' 
      }),
      
      disconnect: () => {
        const { websocket } = get();
        if (websocket) {
          websocket.close();
          set({ 
            websocket: null, 
            isConnected: false,
            websocketText: [],
            unformattedWebsocketText: ''
          });
        }
      },
      
      connect: (meetingId: string, meeting: any, userDetails: any) => {
        const { disconnect } = get();
        
        // Disconnect existing connection
        disconnect();
        
        // This will be implemented in the actual WebSocket hook
        // For now, just set up the structure
        set({ error: null, isConnected: false });
      },
    })),
  );

  return (
    <WebSocketContext.Provider value={store}>
      {children}
    </WebSocketContext.Provider>
  );
};

export function useWebSocketStore<T>(selector: (state: WebSocketStore) => T) {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('WebSocketProvider is missing');
  }
  return useStore(context, selector);
}
