export type Meeting = {
  id?: number;
  title?: string | null;
  start_timestamp?: string;
  analysis_status?: string; // Consider making this an enum if fixed values are used
  channel?: string | null;
  meeting_id?: string | null;
  end_timestamp?: string | null;
  app_id?: string | null;
  bot_name?: string | null;
  call_recording_url?: string | null;
  listener_id?: string | null;
  phone_number?: string | null;
  postcall_analysis?: string | null;
  postcall_analysis_webhook?: string | null;
  postcall_transcript?: string | null;
  link?: string | null;
};

export type MeetingInfoProps = {
  // title: string | null;
  // channel: string | null;
  summary?: string | null;
  isUserLoading: boolean;
  userName: string;
  userSysId: string;
  isDisconnectButtonDisabled: boolean;
  handleDisconnect: () => void;
  isDisconnecting?: boolean;
  // status: string;
  meetingId: string;
  extra: string;
  scope: 'copilot' | 'postcall';
};

export type VoiceVirtualMeetingInfoProps = {
  created_at: string;
  ended_at: string;
  status: string;
  userName: string;
  phoneNumber: string;
  extra: string;
  scope: 'copilot' | 'postcall';
};
