export interface Session {
  id: string
  name: string
  appId: string
  sessionType: 'incident' | 'change' | 'adhoc' | 'alert'
  status: 'open' | 'resolved'
  severity?: 'P1' | 'P2' | 'P3' | 'P4'
  createdBy: string;
  created_at?: string;
  sharedWith: string[]
  isPinned: boolean
  lastUpdated: string
  unreadCount: number
}

export interface Incident {
  id: string
  subject: string
  description: string
  severity?: string
  status?: string
  createdTime?: string
  created_at?: string;
  url?: string,
  chat_available?: boolean,
  session_id?: string,
  number?: string;
}

