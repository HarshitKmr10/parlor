/**
 * CallerInfo Component
 *
 * Displays comprehensive caller information and call controls including:
 * - User name and contact details (phone/meeting link)
 * - Call duration and status
 * - Call type indicators (Phone/Meet)
 * - Action buttons (End Call, Create Incident, Postcall)
 * - Copy-to-clipboard functionality
 * - Modal dialogs for ticket creation and KB creation
 *
 * Data is sourced from Zustand store (CopilotStore) and meeting details hook
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';

// Radix UI Components
import { Box, Flex } from '@radix-ui/themes';

// Custom Icons

// Store and Context
import { useGlobalContext } from 'contexts/store';
import { useCopilotStore } from 'store/Copilot';

// Hooks
import useMeetingDetails from 'hooks/useMeetingDetails';

// API and Utils
import { API } from 'api';
import { copyToClipboard } from 'utils/stringUtils';

// Components
import CallerInfoHeader from './CallerInfoHeader';
import CallerInfoDetails from './CallerInfoDetails';
import EndCallDialog from './EndCallDialog';
import CreateCopilotTicketModal from '../CreateCopilotTicketModal';
import UserSearchModal from '../UserSearchModal';
import CustomAvatar from '@/components/CustomAvatar';

// Styles
import { callerInfoStyles } from './CallerInfo.styles';
import CallerInfoActions from './CallerInfoActions';

/**
 * Props interface for CallerInfo component
 */
interface CallerInfoProps {
  /** Type of copilot session (Copilot, P1, or KnowledgeAssist) */
  type?: 'Copilot' | 'P1' | 'KnowledgeAssist';
  /** Function to update parent component's status state */
  setStatus: React.Dispatch<React.SetStateAction<string>>;
}

function CallerInfo({ type = 'Copilot', setStatus }: CallerInfoProps) {
  // ========== Data Fetching ==========
  // Get meeting and user data from Zustand store
  const meeting = useCopilotStore((state) => state.meeting);
  const userDetails = useCopilotStore((state) => state.userDetails);
  const showUserSearchModal = useCopilotStore((state) => state.showUserSearchModal);
  const setShowUserSearchModal = useCopilotStore((state) => state.setShowUserSearchModal);

  // ========== Derived Values ==========
  // Extract user information from store
  const userName = userDetails?.fullName || '';
  const userPhone = userDetails?.mobilePhone || '';

  // Extract meeting information from store
  const meetingId = meeting?.meeting_id || '';
  const channel = meeting?.channel;
  const title = meeting?.title || '';
  const link = meeting?.link || '';
  const incomingOrOutgoing = meeting?.title?.startsWith('Incoming Call') ? 'Incoming Call' : 'Outgoing Call';

  // ========== Hooks and State ==========
  // Local status for tracking
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  // Meeting details and device context
  const { device } = useGlobalContext();
  const { status, loading, listenerId, error } = useMeetingDetails(meetingId);

  // Navigation and URL params
  const router = useRouter();
  const searchParams = useSearchParams();
  const isGenesysService = searchParams.get('service') === 'genesis';

  // ========== Component State ==========
  // Call management states
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showEndCallConfirm, setShowEndCallConfirm] = useState(false);

  // Copy functionality states
  const [isCopied, setIsCopied] = useState(false);

  // Ticket creation states
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  // ========== Effects ==========
  // Sync status with parent component and local state
  useEffect(() => {
    setStatus(status);
    setLocalStatus(status);
  }, [status, setStatus]);

  // Navigate to /calls when service is genesis and analysis is done, doesn't need anymore
  // useEffect(() => {
  //   if (isGenesysService && (status === 'meeting_ended')) {
  //     setTimeout(() => {
  //       router.replace('/calls');
  //     }, 5000);
  //   }
  // }, [isGenesysService, status, router]);


  // ========== Event Handlers ==========

  /**
   * Initiates the call disconnection process
   * Handles both phone calls and meeting bots
   */
  const disconnectCall = async () => {
    setIsDisconnecting(true);

    /**
     * Disconnects phone calls using the device API
     */
    const disconnectPhone = async () => {
      try {

        if (!device) {
          console.error('Device is not available');
          return;
        }

        const activeCalls = device?.calls;
        try {
          device.disconnectAll();
          toast.success('Call disconnected');
        } catch (error) {
          toast.error('No Active Calls to disconnect');
        }

        if (!device?.calls) toast.error('No Active Calls found !!');

        if (activeCalls && Array.isArray(activeCalls) && activeCalls.length > 0) {
          // Get the first active call and disconnect it
          const activeCall = activeCalls[0];
          if (activeCall && typeof activeCall.disconnect === 'function') {
            await activeCall.disconnect();
          } else {
            console.error('Active call does not have disconnect method', activeCall);
          }
        } else {
          console.log();
        }
      } catch (e) {
        console.error(`Error in disconnecting call: ${e}`);
      }
    };

    /**
     * Removes meeting bot for non-phone calls
     */
    const removeBot = async (botId: string) => {
      await API.KnowledgeAI.removeKnowledgeAIMeeting(botId);
    };

    try {
      if (channel === 'Phone') {
        await disconnectPhone();
      } else {
        await removeBot(listenerId);
      }
    } catch (e) {
      console.error(`Error in handleDisconnect: ${e}`);
    } finally {
      setIsDisconnecting(false);
    }
  };

  /**
   * Shows the end call confirmation dialog
   */
  const handleDisconnect = () => {
    setShowEndCallConfirm(true);
  };

  /**
   * Handles copying phone number or meeting link to clipboard
   * @param textToCopy - Optional specific text to copy, otherwise uses context-appropriate content
   */
  const handleCopyPhone = useCallback(
    (textToCopy?: string) => {
      try {
        let contentToCopy = textToCopy;
        if (!contentToCopy) {
          if (userPhone && channel === 'Phone') {
            contentToCopy = userPhone;
          } else if (link && channel === 'Meet') {
            contentToCopy = link;
          } else {
            console.error('No valid content to copy');
            return;
          }
        }

        copyToClipboard(contentToCopy);
        setIsCopied(true);

        // Reset copied state after 2 seconds
        setTimeout(() => setIsCopied(false), 2000);
      } catch (e) {
        console.error('Failed to copy content:', e);
      }
    },
    [userPhone, channel, link],
  );

  // ========== Error Handling ==========
  if (error) {
    throw error;
  }

  // ========== Render ==========
  return (
    <Flex direction="column" align="center" justify="center" className={callerInfoStyles.container}>
      {/* Main Content Container */}
      <Flex align={'start'} gapX="2" className={callerInfoStyles.layout.mainContainer}>
        <div className="flex-shrink-0">
          <CustomAvatar alt="image" src={null} name={userName} height="34px" width="34px" />
        </div>
        <Box className={callerInfoStyles.layout.contentBox}>
          {/* Header Section: User Info and Status */}
          <CallerInfoHeader
            userName={userName}
            userPhone={userPhone}
            title={title}
            link={link}
            channel={channel}
            isCopied={isCopied}
            status={status}
            loading={loading}
            onCopyPhone={handleCopyPhone}
          />

          {/* Call Details and Actions Section */}
          <Flex
            gapX="2"
            align="center"
            justify="between"
            className={callerInfoStyles.layout.detailsActionsSection}
          >
            <Flex
              gapX="2"
              align="center"
              justify="between"
              className={callerInfoStyles.layout.nestedContainer}
            >
              {/* Call Information */}
              <CallerInfoDetails
                channel={channel}
                incomingOrOutgoing={incomingOrOutgoing}
                meeting={meeting}
                status={localStatus}
              />
              {/* Action Buttons - Hidden for Genesys service, shown only when analysis is done */}
              {(!isGenesysService || status === 'analysis_done') && (
                <CallerInfoActions
                  status={status}
                  type={type}
                  meetingId={meetingId}
                  isDisconnecting={isDisconnecting}
                  loading={loading}
                  onNavigate={router.push}
                  onDisconnect={handleDisconnect}
                  onOpenTicketModal={() => setIsTicketModalOpen(true)}
                />
              )}
            </Flex>
          </Flex>
        </Box>
      </Flex>

      {/* Ticket Creation Modal */}
      <CreateCopilotTicketModal
        open={isTicketModalOpen}
        setOpen={setIsTicketModalOpen}
        meetingId={meetingId}
      />

      {/* User Search Modal - shown when user not found by phone */}
      <UserSearchModal
        open={showUserSearchModal}
        onClose={() => setShowUserSearchModal(false)}
      />

      {/* End Call Confirmation Dialog */}
      <EndCallDialog
        open={showEndCallConfirm}
        onOpenChange={setShowEndCallConfirm}
        isDisconnecting={isDisconnecting}
        onConfirmDisconnect={disconnectCall}
      />
    </Flex>
  );
}

export default CallerInfo;
