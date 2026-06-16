'use client';

import { useSimulationThemes } from '@/hooks/train-assist/useSimulation';
import { Clock } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import Shimmer from '@/components/common/Shimmer';
import { Badge, Box, Button, Flex, Heading, Text } from '@radix-ui/themes';
import { startSimulation } from '@/api/trainAssistV2/api';
import dynamic from 'next/dynamic';
import './styles.css';
import { EmptySimulations } from '@/components/icons/EmptySimulations';
import { useTranslation } from 'react-i18next';

const VoiceSimulatorModal = dynamic(() => import('./VoiceSimulation'), { ssr: false });

interface Props {
  id: string;
  onStartSimulation: (data: {
    simulation_session_id: string;
    initial_customer_message: string;
  }) => void;
  config?: {
    voice_simulation_enabled?: boolean;
    chat_simulation_enabled?: boolean;
  };
}

const difficultyStyles: Record<string, string> = {
  Easy: 'bg-indigo-100 text-indigo-700',
  Medium: 'bg-[#e8eeff] text-[#3b5efb]',
  Hard: 'bg-red-100 text-red-700',
};

const SimulationTab = ({ id, onStartSimulation, config }: Props) => {
  const { t } = useTranslation();
  const { data, loading, error } = useSimulationThemes(id);
  const [startingThemeId, setStartingThemeId] = React.useState<string | null>(null);
  const [voiceModalOpen, setVoiceModalOpen] = React.useState(false);
  const [currentThemeId, setCurrentThemeId] = React.useState('');
  const [currentThemeTitle, setCurrentThemeTitle] = React.useState('');

  const handleStartSimulation = async (themeId: string) => {
    try {
      setStartingThemeId(themeId); // Mark this button as loading
      const result = await startSimulation(themeId);
      onStartSimulation(result);
    } catch (err) {
      console.error('Failed to start/send simulation', err);
    } finally {
      setStartingThemeId(null); // Reset the loading state
    }
  };

  const handleVoiceSimulation = useCallback((themeId: string, themeTitle: string) => {
    setCurrentThemeId(themeId);
    setCurrentThemeTitle(themeTitle);
    setVoiceModalOpen(true);
  }, []);

  const closeSimulatorModal = useCallback(() => {
    setCurrentThemeId('');
    setCurrentThemeTitle('');
    setVoiceModalOpen(false);
  }, []);

  // Determine which buttons to show based on config
  // Default to true if keys are not present
  const showChatSimulation = useMemo(() => {
    return config["Modules"]?.train_assist?.chat_simulation_enabled;
  }, [config["Modules"]?.train_assist?.chat_simulation_enabled]);

  const showVoiceSimulation = useMemo(() => {
    return config["Modules"]?.train_assist?.voice_simultation_enabled;
  }, [config["Modules"]?.train_assist?.voice_simultation_enabled]);


  return (
    <Box className="space-y-6 overflow-y-scroll px-[14px] py-[18px]">
      <Heading as="h3" className="text-[17px] font-medium leading-[20px] tracking-[-0.23px]">
        {t('trainAssist.situationalSimulations')}
      </Heading>

      {loading && (
        <div className="space-y-4">
          <Shimmer className="h-[180px] w-full rounded-xl" />
          <Shimmer className="h-[180px] w-full rounded-xl" />
        </div>
      )}

      {!!error && (
        <Text color="red" align="center">
          {error}
        </Text>
      )}

      {!loading && !error && data && data.length === 0 && (
        <Box className="flex flex-col items-center justify-center py-16 text-center">
          <EmptySimulations className="mb-6 h-24 w-32 text-gray-400" />
          <Heading as="h4" size="4" className="mb-2 font-semibold text-gray-900">
            {t('trainAssist.simulationNotAvailable')}
          </Heading>
          <Text size="3" color="gray" className="max-w-md">
            {t('trainAssist.insufficientTroubleshootingInstructions')}
          </Text>
        </Box>
      )}

      {!loading &&
        !error &&
        data?.map((theme) => (
          <Box
            key={theme?.id}
            className="rounded-xl border shadow-sm transition-all hover:shadow-md"
          >
            <Box className="space-y-4 p-5">
              {/* Title & Meta */}
              <Flex direction="column" justify="between" align="start">
                <Flex justify="between" align="center" className="w-full">
                  <Text as="div" size="3" weight="medium">
                    {theme?.title}
                  </Text>
                  <Flex direction="row" align="center" gap="4">
                    <span
                      className={`rounded-full px-3 py-1 text-small font-medium ${difficultyStyles[theme.difficulty] || 'bg-gray-100 text-gray-700'}`}
                    >
                      {theme?.difficulty}
                    </span>
                    <Flex align="center" gap="1" className="text-muted-foreground text-xs">
                      <Clock className="h-4 w-4" />
                      <span>
                        {t('trainAssist.estimatedTime')} {Math.floor(theme?.time_limit_seconds / 60)} {t('trainAssist.minutes')}
                      </span>
                    </Flex>
                  </Flex>
                </Flex>
                <Box>
                  <Text as="p" size="2" color="gray" className="mt-1">
                    {theme?.description}
                  </Text>
                </Box>
              </Flex>

              {/* Keywords */}
              <Flex wrap="wrap" gap="2">
                {theme?.keywords.map((tag) => (
                  <Badge
                    key={tag}
                    className="rounded-full bg-[rgba(66,133,244,0.1)] px-4 py-1 text-[14px] font-medium text-[#3b82f6]"
                  >
                    {tag}
                  </Badge>
                ))}
              </Flex>

              {/* Action Buttons */}
              <Box>
                <Flex gap="2" wrap="wrap">
                  {showChatSimulation && (
                    <Button
                      variant="outline"
                      disabled={startingThemeId === theme?.id}
                      onClick={() => handleStartSimulation(theme?.id)}
                      className="cursor-pointer rounded-md border-indigo-500 text-indigo-700 hover:bg-indigo-50"
                    >
                      {startingThemeId === theme?.id ? t('trainAssist.starting') : t('trainAssist.startChatSimulation')}
                    </Button>
                  )}

                  {showVoiceSimulation && (
                    <Button
                      variant="surface"
                      onClick={() => handleVoiceSimulation(theme?.id, theme?.title || '')}
                      className="cursor-pointer rounded-md border-green-500 text-green-700 hover:bg-green-50"
                    >
                      {t('trainAssist.startVoiceSimulation')}
                    </Button>
                  )}
                </Flex>
              </Box>
            </Box>
          </Box>
        ))}
      {voiceModalOpen && currentThemeId !== '' && (
        <VoiceSimulatorModal
          open={voiceModalOpen}
          onClose={closeSimulatorModal}
          themeId={currentThemeId}
          themeTitle={currentThemeTitle}
        />
      )}
    </Box>
  );
};

export default SimulationTab;
