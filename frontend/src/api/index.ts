// Import only what's necessary
import { Teams } from 'api/teams';
import { Meetings } from 'api/meetings';
import { MeetingJoiner } from 'api/meetingJoiner';
import { AgentChat } from './agentChat';
import { User } from './user';
import { VoiceVirtualCalls } from './voiceVirtualAgent';
import { ChatVirtualCalls } from './chatVirtualAgent';
import { KnowledgeAI } from './knowledgeAI';
import { Feedback } from './feedback';
// Import chat functionality
import * as ChatModels from './chat/models';
import * as WebSocketCalls from './websocket';

export const fetchDataAsText = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`HTTP error! Status: ${res.status}`);
  }
  const text = await res.text();
  return text;
};

export const API = {
  AgentChat,
  Teams,
  Meetings,
  MeetingJoiner,
  User,
  VoiceVirtualCalls,
  ChatVirtualCalls,
  WebSocketCalls,
  KnowledgeAI,
  Feedback,
};

export const Models = {
  Chat: ChatModels,
};
