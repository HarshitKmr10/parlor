'use client';

import { VoiceAgentCalls, VoiceAgents } from 'api/voiceVirtualAgent';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Box, Flex } from '@radix-ui/themes';
import VoiceVirtualCallListHeader from './VoiceVirtualCallListHeader';
import VoiceVirtualCallItem from './VoiceVirtualCallItem';
import { useForm } from 'react-hook-form';
import useDebounce from 'hooks/useDebounce';
import SearchBar from './SearchBar';
import { useTranslation } from 'react-i18next';

interface FormValues {
  search: string;
}

interface VoiceVirtualCallListProps {
  calls: VoiceAgentCalls[];
  onSelect: (call: VoiceAgentCalls) => void;
  voiceAgents: VoiceAgents[];
  selectedAgent: VoiceAgents | null;
  onAgentChange: (agent: VoiceAgents) => void;
}

function VoiceVirtualCallList({
  calls = [],
  onSelect,
  voiceAgents = [],
  selectedAgent,
  onAgentChange,
}: VoiceVirtualCallListProps) {
  const { t } = useTranslation();
  const [selectedCall, setSelectedCall] = useState<VoiceAgentCalls | null>(null);
  const { register, watch } = useForm<FormValues>({ defaultValues: { search: '' } });
  const searchValue = watch('search');
  const debouncedSearchValue = useDebounce<string>(searchValue, 300);

  const isFiltering = searchValue !== debouncedSearchValue;

  const handleCallSelect = useCallback(
    (call: VoiceAgentCalls) => {
      if (!call) return;
      setSelectedCall(call);
      onSelect(call);
    },
    [onSelect]
  );

  const filteredCalls = useMemo(() => {
    if (!Array.isArray(calls) || !selectedAgent) return [];
    const callsShown = calls.filter(
      (call) => call && call.called_at === selectedAgent.phone_number
    );
    if (!debouncedSearchValue) return callsShown;

    const lowerCaseSearch = debouncedSearchValue.toLowerCase();
    return callsShown.filter(
      (call) =>
        (call.user_name && call.user_name.toLowerCase().includes(lowerCaseSearch)) ||
        (call.caller && call.caller.toLowerCase().includes(lowerCaseSearch))
    );
  }, [calls, debouncedSearchValue, selectedAgent]);

  const ShimmerLoader = () => (
    <Box className="space-y-4 p-4">
      {[...Array(3)].map((_, index) => (
        <Box key={index} className="animate-pulse flex space-x-4">
          <Box className="rounded-lg bg-gray-300 h-12 w-12"></Box>
          <Box className="flex-1 space-y-2 py-1">
            <Box className="h-4 bg-gray-300 rounded w-3/4"></Box>
            <Box className="h-4 bg-gray-300 rounded w-1/2"></Box>
          </Box>
        </Box>
      ))}
    </Box>
  );

  return (
    <Flex direction="column" className="h-full border-r border-[var(--gray-8)]">
      <Box className="flex-shrink-0">
        <VoiceVirtualCallListHeader
          voiceAgents={Array.isArray(voiceAgents) ? voiceAgents : []}
          selectedAgent={selectedAgent}
          onAgentChange={onAgentChange}
        />
      </Box>

      <Box className="p-2">
        <SearchBar register={register} placeholder={t('voice_virtual_agent.searchViaNameOrPhonenumber')} />
      </Box>

      <Box className="overflow-auto">
        {isFiltering ? (
          <ShimmerLoader />
        ) : Array.isArray(filteredCalls) && filteredCalls.length > 0 ? (
          filteredCalls.map((call) =>
            call ? (
              <VoiceVirtualCallItem
                key={call.id}
                call={call}
                onSelect={handleCallSelect}
                isSelected={selectedCall?.id === call.id}
              />
            ) : null
          )
        ) : (
          <div className="p-4 text-center text-gray-500">{t('voice_virtual_agent.noCallsFound')}</div>
        )}
      </Box>
    </Flex>
  );
}

export default VoiceVirtualCallList;
