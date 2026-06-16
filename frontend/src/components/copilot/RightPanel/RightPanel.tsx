import React, { useState, useCallback } from 'react';
import { Box, Tabs, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useOrganizationConfig } from 'hooks/useOrganizationConfig';
import Suggestions from '../Suggestions';
import CreatedTickets from '../CreatedTickets';
import PDFModal from 'components/Modals/PDFModal';

/**
 * RightPanel Component
 * 
 * Displays the right panel of the copilot interface containing:
 * - AI Suggestions: Shows AI-generated suggestions and responses
 * - Created Tickets: Displays list of created tickets from the meeting
 * 
 * Both tabs remain mounted in the background to preserve state and prevent re-rendering.
 * Only visibility is toggled when switching tabs.
 * 
 * Memoized to prevent unnecessary re-renders when parent components update.
 */
const RightPanel = React.memo(function RightPanel() {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState('suggestedResponse');
  const [activeCitation, setActiveCitation] = useState('');
  const [showCitation, setShowCitation] = useState(false);
  const { config } = useOrganizationConfig();
  
  // Check if ticket integration is enabled
  const isTicketIntegrationEnabled = config?.ticketIntegrationEnabled || false;

  const handleTabChange = useCallback((value: string) => {
    setSelectedTab(value);
  }, []);

  return (
    <>
      <Tabs.Root
        value={selectedTab}
        onValueChange={handleTabChange}
        className="flex h-full flex-col"
      >
        <Box className="flex-shrink-0">
          <Tabs.List>
            <Tabs.Trigger className="cursor-pointer" value="suggestedResponse">
              <Text size="1">{t('voice_copilot.aiSuggestions')}</Text>
            </Tabs.Trigger>
            {isTicketIntegrationEnabled && (
              <Tabs.Trigger className="cursor-pointer" value="createdTickets">
                <Text size="1">{t('voice_copilot.createdTickets')}</Text>
              </Tabs.Trigger>
            )}
          </Tabs.List>
        </Box>

        <Box className="flex-grow overflow-auto relative">
          {/* AI Suggestions Tab - Always mounted, visibility toggled */}
          <Box 
            className="h-full"
            style={{ 
              display: selectedTab === 'suggestedResponse' ? 'block' : 'none' 
            }}
          >
            <Suggestions
              setActiveCitation={setActiveCitation}
              setShowCitation={setShowCitation}
              app_id="voice_copilot"
            />
          </Box>

          {/* Created Tickets Tab - Always mounted, visibility toggled */}
          {isTicketIntegrationEnabled && (
            <Box 
              className="h-full"
              style={{ 
                display: selectedTab === 'createdTickets' ? 'block' : 'none' 
              }}
            >
              <CreatedTickets isVisible={selectedTab === 'createdTickets'} />
            </Box>
          )}
        </Box>
      </Tabs.Root>

      {showCitation && !!activeCitation && (
        <PDFModal onClose={() => setShowCitation(false)} url={activeCitation} />
      )}
    </>
  );
});

export default React.memo(RightPanel);

