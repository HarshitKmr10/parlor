'use client';

import React, { useState, useCallback, Suspense, useEffect, useRef } from 'react';
import { Box, Flex, Text, Button, AlertDialog } from '@radix-ui/themes';
import { useSearchParams, useRouter } from 'next/navigation';
import Spinner from 'components/spinner/spinner';
import { useGlobalContext } from 'contexts/store';
import { useOrganizationConfig } from 'hooks/useOrganizationConfig';
import { useCopilotStore, CopilotProvider } from 'store/Copilot';
import { WebSocketProvider, useWebSocketStore } from 'store/WebSocket';
import { TicketsProvider, useTicketsStore } from 'store/Tickets/TicketsStore';
import { DevicesProvider, useDevicesStore } from 'store/Devices/DevicesStore';
import { useSuggestionsStore } from 'store/Suggestions';
import useWebSocketConnection from 'hooks/useWebSocketStore';
import useMeetingDuration from 'hooks/useMeetingDuration';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { MicrophoneAccess } from 'components/common/MicrophoneAccess';
import { copilotStyles } from './copilot.styles';
import Header from '@/components/copilot/Header';
import ChatSection from '@/components/copilot/ChatSection';

// ==================== Lazy-loaded Components ====================
const LeftPanel = React.lazy(() => import('components/copilot/LeftPanel'));
const RightPanel = React.lazy(() => import('components/copilot/RightPanel'));

/**
 * CopilotContent Component
 *
 * Main content component for the Voice Co-Resolve copilot interface.
 * Manages:
 * - WebSocket connections for real-time transcript
 * - Three-panel layout with toggleable chat panel
 * - Microphone permissions
 * - Loading and error states
 */
function CopilotContent() {
  // ==================== Routing & Context ====================
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const meetingId = searchParams.get('meetingId');
  const showSideBar = searchParams.get('showSideBar');
  const { organization } = useGlobalContext();
  const [status, setStatus] = useState(null);

  // ==================== Configuration ====================
  const { config, loading: configLoading, error: configError } = useOrganizationConfig();

  // ==================== Store State ====================
  // Copilot Store
  const isUserLoading = useCopilotStore((state) => state.isUserLoading);
  const meeting = useCopilotStore((state) => state.meeting);
  const userDetails = useCopilotStore((state) => state.userDetails);
  const userError = useCopilotStore((state) => state.error);
  const setConfig = useCopilotStore((state) => state.setConfig);
  const resetCopilotStore = useCopilotStore((state) => state.reset);

  // WebSocket Store
  const websocketError = useWebSocketStore((state) => state.error);

  const duration = useMeetingDuration(meeting, status);

  // Tickets Store
  const setTicketsConfig = useTicketsStore((state) => state.setConfig);
  const fetchTickets = useTicketsStore((state) => state.fetchTickets);

  // Devices Store
  const setDevicesConfig = useDevicesStore((state) => state.setConfig);
  const fetchDeviceDetails = useDevicesStore((state) => state.fetchDeviceDetails);

  // Suggestions Store
  const clearSuggestions = useSuggestionsStore((state) => state.clearSuggestions);

  // ==================== Local State ====================
  const [showMicrophoneDialog, setShowMicrophoneDialog] = useState(false);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(33.33); // percentage
  const [chatPanelWidth, setChatPanelWidth] = useState(25); // percentage
  const [isDragging, setIsDragging] = useState<'left' | 'chat' | null>(null);
  const [showMeetingEndedDialog, setShowMeetingEndedDialog] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialDelayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [phoneIntegrationEnabled, setPhoneIntegrationEnabled] = useState<boolean>(false);
  const [showStayBanner, setShowStayBanner] = useState(false);
  const [useSnowUI, setUseSnowUI] = useState<boolean>(false);

  // ==================== WebSocket Initialization ====================
  // Handles both UnifiedWebSocketStore (genesis/cisco) and legacy WebSocket (Meet/Phone) internally
  useWebSocketConnection(meetingId, meeting, userDetails);

  // ==================== Effects ====================
  /**
   * Check useSnowUI feature flag and update URL with showSideBar=false when enabled
   */
  useEffect(() => {
    if (!organization?.config || !meetingId) {
      return;
    }

    try {
      const orgConfig = JSON.parse(organization.config);
      const voiceCopilot = orgConfig.Modules?.voice_copilot?.features;
      const snowUI = voiceCopilot?.useSnowUI?.enabled || false;
      setUseSnowUI(snowUI);

      const params = new URLSearchParams(searchParams.toString());
      
      if (snowUI && showSideBar !== 'false') {
        params.set('showSideBar', 'false');
        router.replace(`/copilot?${params.toString()}`, { scroll: false });
      } else if (!snowUI && showSideBar === 'false') {
        params.delete('showSideBar');
        router.replace(`/copilot?${params.toString()}`, { scroll: false });
      }
    } catch (e) {
      console.error('Error parsing organization config:', e);
    }
  }, [organization, meetingId, showSideBar, searchParams, router]);

  /**
   * Check phone integration enabled status from organization config
   */
  useEffect(() => {
    if (!organization?.config) {
      return;
    }

    try {
      const orgConfig = JSON.parse(organization.config);
      const voiceCopilot = orgConfig.Modules?.voice_copilot?.features;
      const phoneIntegration = voiceCopilot?.phoneIntegration?.enabled || false;
      setPhoneIntegrationEnabled(phoneIntegration);
    } catch (e) {
      console.error('Error parsing organization config:', e);
      setPhoneIntegrationEnabled(false);
    }
  }, [organization]);

  /**
   * Update Copilot store config when organization config changes
   */
  useEffect(() => {
    if (config) {
      setConfig({
        integration: config.ticketingSystem || '',
      });

      // Configure TicketsStore
      setTicketsConfig({
        integration: config.ticketingSystem || '',
        fetchTicketsDetails: true,
      });

      // Configure DevicesStore
      setDevicesConfig({
        endpointManagement: config.endpointManagement || false,
        endpointSystem: config.endpointSystem || '',
        fetchDeviceInfo: true,
      });
    }
  }, [config, setConfig, setTicketsConfig, setDevicesConfig]);

  /**
   * Fetch tickets when user details change
   */
  useEffect(() => {
    if (userDetails?.employeeId) {
      fetchTickets({
        employeeId: userDetails.employeeId,
        mobilePhone: userDetails.mobilePhone,
        fullName: userDetails.fullName,
        email: userDetails.email,
        employeeNumber: userDetails.employeeNumber,
      });
    }
  }, [userDetails?.employeeId, userDetails?.mobilePhone, userDetails?.fullName, userDetails?.email, userDetails?.employeeNumber, fetchTickets]);

  /**
   * Fetch device details when user details change
   */
  useEffect(() => {
    if (userDetails?.email) {
      fetchDeviceDetails({
        email: userDetails.email,
      });
    }
  }, [userDetails?.email, fetchDeviceDetails]);

  /**
   * Request microphone permissions on mount
   */
  useEffect(() => {
    if (phoneIntegrationEnabled) {
      getMicrophoneAccess().catch(() => {
        toast.error('Failed to get microphone access');
      });
    }
  }, [phoneIntegrationEnabled]);

  /**
   * Cleanup: Clear store states when navigating away from copilot page
   */
  useEffect(() => {
    return () => {
      // Clear both stores when component unmounts
      resetCopilotStore();
      clearSuggestions();
    };
  }, [resetCopilotStore, clearSuggestions]);

  /**
   * Handle meeting ended - wait 10 seconds, then show dialog with 5-second countdown
   */
  const handleMeetingEnded = useCallback(() => {
    // Clear any existing timeouts/intervals first
    if (initialDelayTimeoutRef.current) {
      clearTimeout(initialDelayTimeoutRef.current);
      initialDelayTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // Wait 10 seconds before showing the dialog
    const delayTimeout = setTimeout(() => {
      setShowMeetingEndedDialog(true);
      setCountdown(5);

      // Start 5-second countdown timer
      const intervalId = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(intervalId);
            countdownIntervalRef.current = null;
            const redirectUrl = useSnowUI 
              ? '/calls?showCall=true&showSideBar=false'
              : '/calls?showCall=true';
            router.replace(redirectUrl);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      countdownIntervalRef.current = intervalId;
      initialDelayTimeoutRef.current = null;
    }, 10000); // 10 seconds delay

    initialDelayTimeoutRef.current = delayTimeout;
  }, [router]);

  /**
   * Cleanup countdown interval and initial delay timeout when component unmounts
   */
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (initialDelayTimeoutRef.current) {
        clearTimeout(initialDelayTimeoutRef.current);
        initialDelayTimeoutRef.current = null;
      }
    };
  }, []);

  /**
   * Handle dialog close - cleanup interval and show banner
   */
  const handleDialogClose = useCallback((open: boolean) => {
    if (!open) {
      // User closed the dialog - stop countdown and show banner
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdown(5); // Reset countdown
      setShowStayBanner(true); // Show banner with instructions
    }
    setShowMeetingEndedDialog(open);
  }, []);

  // ==================== Handlers ====================
  /**
   * Request microphone access from the browser
   */
  const getMicrophoneAccess = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setShowMicrophoneDialog(false);
      return true;
    } catch (error) {
      setShowMicrophoneDialog(true);
      return false;
    }
  }, []);

  /**
   * Handle retry button click in microphone permission dialog
   */
  const handleRetryMicrophone = useCallback(() => {
    setShowMicrophoneDialog(false);
    getMicrophoneAccess();
    router.back();
  }, [getMicrophoneAccess, router]);

  /**
   * Toggle chat panel visibility
   */
  const toggleChatPanel = useCallback(() => {
    setIsChatPanelOpen((prev) => !prev);
  }, []);

  /**
   * Handle back button click - navigate to /calls with showSideBar=false if useSnowUI is enabled
   */
  const handleBackClick = useCallback(() => {
    if (useSnowUI) {
      router.push('/calls?showCall=true&showSideBar=false');
    } else {
      router.push('/calls?showCall=true');
    }
  }, [useSnowUI, router]);

  /**
   * Handle mouse down on resize handle
   */
  const handleMouseDown = useCallback(
    (handle: 'left' | 'chat') => (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(handle);
    },
    [],
  );

  /**
   * Handle mouse move for resizing panels
   */
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const container = document.querySelector('.panels-container');
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left;
      const containerWidth = containerRect.width;
      const percentage = (mouseX / containerWidth) * 100;

      if (isDragging === 'left') {
        // Resizing left panel (min 20%, max 60%)
        const clampedPercentage = Math.min(Math.max(percentage, 20), 60);
        setLeftPanelWidth(clampedPercentage);
      } else if (isDragging === 'chat' && isChatPanelOpen) {
        // Resizing chat panel from the right edge
        const chatPercentage = 100 - percentage;
        // Chat panel (min 15%, max 40%)
        const clampedPercentage = Math.min(Math.max(chatPercentage, 15), 40);
        setChatPanelWidth(clampedPercentage);
      }
    },
    [isDragging, isChatPanelOpen],
  );

  /**
   * Handle mouse up to stop dragging
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  /**
   * Add/remove mouse event listeners for dragging
   */
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // ==================== Loading State ====================
  if (configLoading || isUserLoading) {
    return <Spinner />;
  }

  // ==================== Error State ====================
  const errors = [configError, userError, websocketError].filter(Boolean);

  if (errors.length > 0) {
    return (
      <Flex direction="column" align="center" justify="center" className="h-screen gap-4">
        <Text size="6" weight="bold">
          {t('voice_copilot.somethingWentWrong')}
        </Text>
        <Text size="3" color="gray" className="max-w-md text-center">
          {t('voice_copilot.unexpectedErrorOccurred')}
        </Text>
        <Button size="3" onClick={() => window.location.reload()}>
          {t('voice_copilot.retry')}
        </Button>
      </Flex>
    );
  }

  // ==================== Derived Data ====================
  const headerTitle =
    JSON.parse(organization?.config || '{}').Modules?.voice_copilot?.name ?? t('voice_copilot.voiceCoResolve');

  // ==================== Derived Calculations ====================
  const middlePanelWidth = isChatPanelOpen
    ? 100 - leftPanelWidth - chatPanelWidth
    : 100 - leftPanelWidth;

  // ==================== Render ====================
  return (
    <Flex direction="column" className={copilotStyles.container}>
      {/* Header */}
      <Header title={headerTitle} onToggleChat={toggleChatPanel} isChatOpen={isChatPanelOpen} onBack={handleBackClick} />

      {/* Main Panels Container */}
      <div className={`${copilotStyles.panelsContainer} panels-container flex`}>
        {/* Left Panel */}
        <Box className="min-w-[10rem] overflow-hidden" style={{ width: `${leftPanelWidth}%` }}>
          <Suspense fallback={<Spinner />}>
            <LeftPanel type="Copilot" onMeetingEnded={handleMeetingEnded} />
          </Suspense>
        </Box>

        {/* Resize Handle - Left/Middle */}
        <div
          className="group relative w-1 flex-shrink-0 cursor-col-resize bg-[var(--gray-8)] hover:bg-[var(--accent-9)]"
          onMouseDown={handleMouseDown('left')}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        {/* Middle Panel (formerly Right Panel) */}
        <Box
          className="flex min-w-[10rem] flex-col overflow-hidden"
          style={{ width: `${middlePanelWidth}%` }}
        >
          <Suspense fallback={<Spinner />}>
            <RightPanel />
          </Suspense>
        </Box>

        {/* Resize Handle - Middle/Chat (always rendered, visibility controlled) */}
        <div
          className="group relative w-1 flex-shrink-0 cursor-col-resize bg-[var(--gray-8)] hover:bg-[var(--accent-9)]"
          onMouseDown={handleMouseDown('chat')}
          style={{ display: isChatPanelOpen ? 'block' : 'none' }}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        {/* Third Panel - Chat Section (always rendered, visibility controlled) */}
        <Box
          className="min-w-[10rem] overflow-hidden border-l border-gray-200"
          style={{
            width: `${chatPanelWidth}%`,
            display: isChatPanelOpen ? 'block' : 'none',
          }}
        >
          <ChatSection
            app_id="voice_copilot_chat_assist"
            agentName={t('voice_copilot.aiAssist')}
            useFloatingWidget={false}
          />
        </Box>
      </div>

      {/* Microphone Permission Dialog */}
      {phoneIntegrationEnabled && (
        <MicrophoneAccess
          open={showMicrophoneDialog}
          onOpenChange={setShowMicrophoneDialog}
          onRetry={handleRetryMicrophone}
        />
      )}

      {/* Stay Banner - Shows when user closes dialog to stay on page */}
      {showStayBanner && (
        <Box
          style={{
            position: 'fixed',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            maxWidth: '600px',
            width: '90%',
          }}
        >
          <Flex
            align="center"
            justify="between"
            gap="3"
            p="3"
            style={{
              backgroundColor: 'var(--blue-3)',
              border: '1px solid var(--blue-7)',
              borderRadius: 'var(--radius-3)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}
          >
            <Flex direction="column" gap="1" style={{ flex: 1 }}>
              <Text size="2" weight="bold" style={{ color: 'var(--blue-11)' }}>
                {t('voice_copilot.callAnalysisComplete')}
              </Text>
              <Text size="1" style={{ color: 'var(--blue-11)' }}>
                {t('voice_copilot.toReceiveNewCalls')}
              </Text>
            </Flex>
            <Button
              size="1"
              variant="ghost"
              onClick={() => setShowStayBanner(false)}
              style={{ flexShrink: 0 }}
            >
              ✕
            </Button>
          </Flex>
        </Box>
      )}

      {/* Meeting Ended Dialog */}
      <AlertDialog.Root open={showMeetingEndedDialog} onOpenChange={handleDialogClose}>
        <AlertDialog.Content style={{ maxWidth: '450px' }}>
          <Flex direction="column" align="center" gap="4" py="4">
            <AlertDialog.Title>{t('voice_copilot.callAnalysisCompleted')}</AlertDialog.Title>

            {/* Circular Timer UI */}
            <Box style={{ position: 'relative', width: '120px', height: '120px' }}>
              <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
                {/* Background circle */}
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--gray-6)" strokeWidth="8" />
                {/* Progress circle */}
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="var(--accent-9)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 50}`}
                  strokeDashoffset={`${2 * Math.PI * 50 * (1 - (5 - countdown) / 5)}`}
                  style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                />
              </svg>
              {/* Countdown number */}
              <Box
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '32px',
                  fontWeight: 'bold',
                  color: 'var(--accent-11)',
                }}
              >
                {countdown}
              </Box>
            </Box>

            <AlertDialog.Description size="2" style={{ textAlign: 'center' }}>
              {t('voice_copilot.callAnalysisIsComplete', { 
                count: countdown, 
                plural: countdown !== 1 ? 's' : ''
              })}
            </AlertDialog.Description>

            <Flex gap="3" mt="2" justify="end" width="100%">
              <AlertDialog.Cancel>
                <Button variant="soft" size="3">
                  {t('voice_copilot.stayHere')}
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action>
                <Button onClick={() => router.replace('/calls')} size="3">
                  {t('voice_copilot.goToCalls')}
                </Button>
              </AlertDialog.Action>
            </Flex>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Flex>
  );
}

/**
 * Copilot Component
 *
 * Root component that provides necessary context providers:
 * - CopilotProvider: Manages copilot state (user, meeting, device, etc.)
 * - TicketsProvider: Manages tickets state and fetching
 * - WebSocketProvider: Manages WebSocket connection for real-time transcript
 */
function Copilot() {
  return (
    <CopilotProvider>
      <TicketsProvider>
        <DevicesProvider>
          <WebSocketProvider>
            <CopilotContent />
          </WebSocketProvider>
        </DevicesProvider>
      </TicketsProvider>
    </CopilotProvider>
  );
}

export default Copilot;
