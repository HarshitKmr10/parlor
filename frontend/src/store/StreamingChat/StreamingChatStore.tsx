'use client';

import { create } from 'zustand';

export type StreamingStage = 'initializing' | 'analyzing' | 'retrieving' | 'generating' | 'streaming' | '';

interface StreamingChatState {
  // State
  isStreaming: boolean;
  streamingText: string;
  streamingStatus: string;
  streamingStage: StreamingStage;
  // Internal buffer for token accumulation (not reactive for subscription purposes)
  _textBuffer: string;
}

interface StreamingChatActions {
  startStreaming: (initialStatus?: string) => void;
  appendToken: (token: string) => void;
  updateStatus: (message: string, stage: StreamingStage) => void;
  finishStreaming: () => void;
  resetStreaming: () => void;
  getTextBuffer: () => string;
}

export type StreamingChatStore = StreamingChatState & StreamingChatActions;

export const useStreamingChatStore = create<StreamingChatStore>((set, get) => ({
  // Initial state
  isStreaming: false,
  streamingText: '',
  streamingStatus: '',
  streamingStage: '',
  _textBuffer: '',

  // Actions
  startStreaming: (initialStatus = 'Connecting...') => {
    set({
      isStreaming: false,
      streamingText: '',
      streamingStatus: initialStatus,
      streamingStage: 'initializing',
      _textBuffer: '',
    });
  },

  appendToken: (token: string) => {
    const newBuffer = get()._textBuffer + token;
    set({
      _textBuffer: newBuffer,
      streamingText: newBuffer,
      isStreaming: true,
      streamingStage: 'streaming',
    });
  },

  updateStatus: (message: string, stage: StreamingStage) => {
    set({
      streamingStatus: message,
      streamingStage: stage,
      isStreaming: stage === 'streaming' || stage === 'generating',
    });
  },

  finishStreaming: () => {
    set({
      isStreaming: false,
      streamingText: '',
      streamingStatus: '',
      streamingStage: '',
      _textBuffer: '',
    });
  },

  resetStreaming: () => {
    set({
      isStreaming: false,
      streamingText: '',
      streamingStatus: '',
      streamingStage: '',
      _textBuffer: '',
    });
  },

  getTextBuffer: () => get()._textBuffer,
}));

// Selectors for optimized subscriptions - components only re-render when their specific slice changes
export const selectIsStreaming = (state: StreamingChatStore) => state.isStreaming;
export const selectStreamingText = (state: StreamingChatStore) => state.streamingText;
export const selectStreamingStatus = (state: StreamingChatStore) => state.streamingStatus;
export const selectStreamingStage = (state: StreamingChatStore) => state.streamingStage;
