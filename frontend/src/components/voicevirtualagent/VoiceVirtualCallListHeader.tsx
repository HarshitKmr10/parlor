// VoiceVirtualCallListHeader.tsx

import React, { useState } from 'react';
import { DropdownMenu, Button } from '@radix-ui/themes';
import { ChevronUpIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { VoiceAgents } from 'api/voiceVirtualAgent';
import { useTranslation } from 'react-i18next';

interface VoiceVirtualCallListHeaderProps {
  voiceAgents: VoiceAgents[];
  selectedAgent: VoiceAgents | null;
  onAgentChange: (agent: VoiceAgents) => void;
}

function VoiceVirtualCallListHeader({
  voiceAgents,
  selectedAgent,
  onAgentChange,
}: VoiceVirtualCallListHeaderProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="sticky top-0 z-10 px-4 py-2 border-b border-[var(--gray-8)]">
      <DropdownMenu.Root onOpenChange={setMenuOpen}>
        <DropdownMenu.Trigger>
          <Button variant="ghost" className="justify-between w-full">
            {selectedAgent ? selectedAgent.name : t('voice_virtual_agent.selectAnAgent')}
            {menuOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className="w-full">
          {voiceAgents.map((agent) => (
            <DropdownMenu.Item
              key={agent.id}
              onSelect={() => onAgentChange(agent)}
            >
              {agent.name}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
}

export default VoiceVirtualCallListHeader;
