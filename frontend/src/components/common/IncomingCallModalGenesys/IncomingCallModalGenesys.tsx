"use client";

import React, { useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useGlobalContext } from "contexts/store";
import { useRouter, usePathname } from "next/navigation";
import { API } from "api";
import { useUnifiedWebSocketStore } from "store/UnifiedWebSocket";
import { styles } from "./IncomingCallModalGenesys.styles";

function IncomingCallModalGenesys() {
  const { user, selectedTeam, organization } = useGlobalContext();
  const router = useRouter();
  const pathname = usePathname();

  // WebSocket incoming call state - using STORE approach (global state)
  const incomingCall = useUnifiedWebSocketStore((state) => state.incomingCall);
  const clearIncomingCall = useUnifiedWebSocketStore((state) => state.clearIncomingCall);
  const clearGenesysTranscripts = useUnifiedWebSocketStore((state) => state.clearTranscript);
  const connect = useUnifiedWebSocketStore((state) => state.connect);
  const isConnected = useUnifiedWebSocketStore((state) => state.isConnected);

  // Cisco-specific: pending navigation from navigate_to_meeting
  const pendingNavigation = useUnifiedWebSocketStore((state) => state.pendingNavigation);
  const clearPendingNavigation = useUnifiedWebSocketStore((state) => state.clearPendingNavigation);

  // Check if voice copilot is enabled
  const isVoiceCopilotEnabled = React.useMemo(() => {
    try {
      if (!organization?.config) return false;
      const config = JSON.parse(organization.config);
      return config?.Modules?.voice_copilot?.enabled || false;
    } catch (error) {
      return false;
    }
  }, [organization?.config]);

  // Check if auto-redirect is enabled
  const isAutoRedirectEnabled = React.useMemo(() => {
    try {
      if (!organization?.config) return false;
      const config = JSON.parse(organization.config);
      return config?.Modules?.voice_copilot?.features?.autoRedirectToCopilot?.enabled || false;
    } catch (error) {
      return false;
    }
  }, [organization?.config]);

  // Get voice integration type from config (cisco or genesys)
  const voiceIntegration = React.useMemo(() => {
    try {
      if (!organization?.config) return null;
      const config = JSON.parse(organization.config);
      return config?.Modules?.voice_copilot?.voice_integration || null;
    } catch (error) {
      return null;
    }
  }, [organization?.config]);

  // Check if we're on the copilot page
  const isOnCopilotPage = pathname?.includes('/copilot');

  // Ref to track processing and prevent duplicate auto-redirects
  const processingCallRef = useRef<string | null>(null);

  // Manage WebSocket connection based on current page
  useEffect(() => {
    // Only manage connection if voice copilot is enabled and user is logged in
    if (!isVoiceCopilotEnabled || !user) {
      return;
    }
    // Not on copilot page: connect for global notifications if not already connected
    if (!isConnected) {
      clearGenesysTranscripts();
      connect(undefined, user?.id, undefined, voiceIntegration, user?.email); // No meetingId for global notifications, pass user id/email for identity and voice integration type
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnCopilotPage, isVoiceCopilotEnabled, user?.id, isConnected, voiceIntegration]);

  // Auto-redirect to copilot page when incoming call is detected and auto-redirect is enabled (Genesys)
  useEffect(() => {
    if (!incomingCall || !isAutoRedirectEnabled || !user || !selectedTeam) {
      return;
    }

    const meetingId = incomingCall.meeting_id;

    // Prevent duplicate processing
    if (!meetingId || processingCallRef.current === meetingId) {
      return;
    }

    const autoAcceptCall = async () => {
      processingCallRef.current = meetingId;

      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auto-redirect timeout')), 10000)
        );

        const createMeetingPromise = API.Teams.CreateIntakeMeeting(
          user,
          meetingId,
          selectedTeam
        );

        await Promise.race([createMeetingPromise, timeoutPromise]);

        router.push(`/copilot?meetingId=${meetingId}&service=genesis`);
        clearIncomingCall();
        processingCallRef.current = null; // Reset after success

      } catch (error) {
        console.error('Auto-redirect failed:', error);
        processingCallRef.current = null; // Allow retry on error
        // If auto-redirect fails, the modal will show for manual acceptance
      }
    };

    autoAcceptCall();

    // Cleanup on unmount
    return () => {
      processingCallRef.current = null;
    };
  }, [incomingCall, isAutoRedirectEnabled, user, selectedTeam, router, clearIncomingCall]);

  // Handle Cisco navigate_to_meeting - auto-redirect when agent answers call in Finesse
  useEffect(() => {
    if (!pendingNavigation || !user || !selectedTeam) {
      return;
    }

    const { meeting_id, service } = pendingNavigation;

    // Prevent duplicate processing
    if (!meeting_id || processingCallRef.current === meeting_id) {
      return;
    }

    const navigateToCopilot = async () => {
      processingCallRef.current = meeting_id;

      try {
        // Create intake entry (fire-and-forget style, but await to ensure it's created)
        API.Teams.CreateIntakeMeeting(user, meeting_id, selectedTeam)
          .then(() => {
            console.log(``);
          })
          .catch((error) => {
            console.error('Failed to create intake entry for Cisco:', error);
          });

        // Navigate immediately without waiting for intake creation
        router.push(`/copilot?meetingId=${meeting_id}&service=${service || 'cisco'}`);
        clearPendingNavigation();
        processingCallRef.current = null;

      } catch (error) {
        console.error('Cisco navigation failed:', error);
        processingCallRef.current = null;
      }
    };

    navigateToCopilot();

    return () => {
      processingCallRef.current = null;
    };
  }, [pendingNavigation, user, selectedTeam, router, clearPendingNavigation]);

  const handleAccept = async () => {
    if (!incomingCall) {
      return;
    }
    
    try {
      const meetingId = incomingCall.meeting_id;
      if (meetingId) {
        await API.Teams.CreateIntakeMeeting(user, meetingId, selectedTeam);
        router.push(`/copilot?meetingId=${meetingId}&service=genesis`);
        clearIncomingCall();
      }
    } catch (error) {
      // Error handling
    }
  };

  const handleReject = () => {
    if (!incomingCall) {
      return;
    }
    
    try {
      clearIncomingCall();
    } catch (error) {
      // Error handling
    }
  };

  // Return early if no incoming call or if auto-redirect is enabled (no need to show modal)
  if (!incomingCall || isAutoRedirectEnabled) {
    return null;
  }

  return (
    <Dialog.Root open={true} modal={false}>
      <Dialog.Content 
        className="fixed right-[10px] bottom-[10px] z-50 bg-white"
        style={styles.modal}
      >
        {/* Six dots icon */}
        <div style={styles.dotsIconContainer}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M5.54171 2.91667C5.54171 3.22609 5.41879 3.52283 5.2 3.74162C4.98121 3.96042 4.68446 4.08333 4.37504 4.08333C4.06562 4.08333 3.76888 3.96042 3.55008 3.74162C3.33129 3.52283 3.20837 3.22609 3.20837 2.91667C3.20837 2.60725 3.33129 2.3105 3.55008 2.09171C3.76888 1.87292 4.06562 1.75 4.37504 1.75C4.68446 1.75 4.98121 1.87292 5.2 2.09171C5.41879 2.3105 5.54171 2.60725 5.54171 2.91667ZM4.37504 8.16667C4.68446 8.16667 4.98121 8.04375 5.2 7.82496C5.41879 7.60616 5.54171 7.30942 5.54171 7C5.54171 6.69058 5.41879 6.39383 5.2 6.17504C4.98121 5.95625 4.68446 5.83333 4.37504 5.83333C4.06562 5.83333 3.76888 5.95625 3.55008 6.17504C3.33129 6.39383 3.20837 6.69058 3.20837 7C3.20837 7.30942 3.33129 7.60616 3.55008 7.82496C3.76888 8.04375 4.06562 8.16667 4.37504 8.16667ZM4.37504 12.25C4.68446 12.25 4.98121 12.1271 5.2 11.9083C5.41879 11.6895 5.54171 11.3928 5.54171 11.0833C5.54171 10.7739 5.41879 10.4772 5.2 10.2584C4.98121 10.0396 4.68446 9.91667 4.37504 9.91667C4.06562 9.91667 3.76888 10.0396 3.55008 10.2584C3.33129 10.4772 3.20837 10.7739 3.20837 11.0833C3.20837 11.3928 3.33129 11.6895 3.55008 11.9083C3.76888 12.1271 4.06562 12.25 4.37504 12.25ZM10.7917 2.91667C10.7917 3.22609 10.6688 3.52283 10.45 3.74162C10.2312 3.96042 9.93446 4.08333 9.62504 4.08333C9.31562 4.08333 9.01888 3.96042 8.80008 3.74162C8.58129 3.52283 8.45837 3.22609 8.45837 2.91667C8.45837 2.60725 8.58129 2.3105 8.80008 2.09171C9.01888 1.87292 9.31562 1.75 9.62504 1.75C9.93446 1.75 10.2312 1.87292 10.45 2.09171C10.6688 2.3105 10.7917 2.60725 10.7917 2.91667ZM9.62504 8.16667C9.93446 8.16667 10.2312 8.04375 10.45 7.82496C10.6688 7.60616 10.7917 7.30942 10.7917 7C10.7917 6.69058 10.6688 6.39383 10.45 6.17504C10.2312 5.95625 9.93446 5.83333 9.62504 5.83333C9.31562 5.83333 9.01888 5.95625 8.80008 6.17504C8.58129 6.39383 8.45837 6.69058 8.45837 7C8.45837 7.30942 8.58129 7.60616 8.80008 7.82496C9.01888 8.04375 9.31562 8.16667 9.62504 8.16667ZM9.62504 12.25C9.93446 12.25 10.2312 12.1271 10.45 11.9083C10.6688 11.6895 10.7917 11.3928 10.7917 11.0833C10.7917 10.7739 10.6688 10.4772 10.45 10.2584C10.2312 10.0396 9.93446 9.91667 9.62504 9.91667C9.31562 9.91667 9.01888 10.0396 8.80008 10.2584C8.58129 10.4772 8.45837 10.7739 8.45837 11.0833C8.45837 11.3928 8.58129 11.6895 8.80008 11.9083C9.01888 12.1271 9.31562 12.25 9.62504 12.25Z" fill="#B0B5BF"/>
          </svg>
        </div>

        {/* Caller info section */}
        <div style={styles.callerInfoSection}>
          {/* Caller ID box */}
          <div style={styles.callerIdBox}>
            {incomingCall.caller_number ? incomingCall.caller_number.slice(-3) : '???'}
          </div>
          
          {/* Phone number */}
          <div style={styles.callerNumberContainer}>
            <div style={styles.callerNumber}>
              {incomingCall.caller_number || "Unknown Caller"}
            </div>
            <div style={styles.callingText}>
              is now calling ...
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={styles.actionButtonsContainer}>
          <button
            onClick={handleAccept}
            style={styles.acceptButton}
            onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#4a4ac0'}
            onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#5B5BD6'}
          >
            Accept
          </button>
          <button
            onClick={handleReject}
            style={styles.rejectButton}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = '#dc3545';
              (e.target as HTMLButtonElement).style.color = 'white';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = 'white';
              (e.target as HTMLButtonElement).style.color = '#dc3545';
            }}
          >
            Reject
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default IncomingCallModalGenesys;
