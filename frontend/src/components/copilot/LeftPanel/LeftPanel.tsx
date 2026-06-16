import React, { useState, useCallback, useEffect } from 'react';
import { Box, Flex } from '@radix-ui/themes';
import CallerInfoTabs from '../LeftPanelTabs';
import CallerInfo from '../CallerInfo';
import { leftPanelStyles } from './LeftPanel.styles';

import { useUnifiedWebSocketStore } from 'store/UnifiedWebSocket';
import { useGlobalContext } from '@/contexts/store';


/**
 * Type representing the different copilot modes
 */
type CopilotType = 'Copilot' | 'P1' | 'KnowledgeAssist';

/**
 * Props for the LeftPanel component
 */
interface LeftPanelProps {
  /** The type of copilot interface to display */
  type?: CopilotType;
  /** Callback when meeting ends */
  onMeetingEnded?: () => void;
}

/**
 * LeftPanel Component
 * 
 * Displays the left panel of the copilot interface containing:
 * - CallerInfo: Shows caller details and action buttons
 * - CallerInfoTabs: Displays tabs for transcript and employee details
 * 
 * This component manages its own state and fetches data from Zustand stores.
 */
function LeftPanel({ type = 'Copilot', onMeetingEnded }: LeftPanelProps) {

  const { user } = useGlobalContext();

  
  // ==================== Local State ====================
  /** Local status state for tracking call status */
  const [localStatus, setLocalStatusState] = useState<string | null>(null);

  const connect = useUnifiedWebSocketStore((state) => state.connect);
  const disconnect = useUnifiedWebSocketStore((state) => state.disconnect);


  useEffect(() => {
    if (localStatus === "analysis_done") {
      
      // Notify parent component that analysis is complete
      onMeetingEnded?.();
    }
  }, [localStatus,  user?.email, onMeetingEnded]);


  
  // ==================== Handlers ====================
  /**
 * Handles status updates from CallerInfo component
   * Supports both direct values and updater functions
   */
  const handleSetStatus = useCallback((status: React.SetStateAction<string>) => {
    const newStatus = typeof status === 'function' 
      ? status(localStatus || '') 
      : status;
    setLocalStatusState(newStatus);
  }, [localStatus]);

  // ==================== Render ====================
  return (
    <Flex direction="column" className={leftPanelStyles.container}>
      {/* Caller Information Section */}
      <Box className={leftPanelStyles.callerInfoSection}>
        <CallerInfo
          type={type}
          setStatus={handleSetStatus}
        />
      </Box>

      {/* Tabs Section (Transcript & Employee Details) */}
      <Box className={leftPanelStyles.tabsSection}>
        <CallerInfoTabs />
      </Box>
    </Flex>
  );
}

export default React.memo(LeftPanel);
