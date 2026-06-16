import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  BounceLoader as LiveIcon,
  ScaleLoader as ProcessingIcon,
} from 'react-spinners';
import { TiTick as DoneIcon } from 'react-icons/ti';
import { Text } from '@radix-ui/themes';
import { Check, TicketIcon } from 'lucide-react';

function Status({ status, channel }) {
  const { t } = useTranslation();
  const values = {
    loading: {
      icon: null,
      title: t('voice_copilot.loading'),
    },
    not_started: {
      icon: <LiveIcon size="clamp(8px, 0.8vw, 12px)" color="#fbbf24" />,
      title: t('voice_copilot.notStarted', { channel }),
    },
    meeting_initiated: {
      icon: <LiveIcon size="clamp(8px, 0.8vw, 12px)" color="#fbbf24" />,
      title: t('voice_copilot.initiated', { channel }),
    },
    meeting_started: {
      icon: <LiveIcon size="clamp(8px, 0.8vw, 12px)" color="#f00" />,
      title: t('voice_copilot.inProgress', { channel }),
    },
    meeting_ended: {
      icon: <ProcessingIcon height="clamp(8px, 0.8vw, 12px)" width={2} color="#818cf8" />,
      title: t('voice_copilot.ended', { channel }),
    },
    transcript_processing: {
      // icon: <LiveIcon size={14} color="#818cf8" />,
      icon: <ProcessingIcon height="clamp(8px, 0.8vw, 12px)" width={2} color="#818cf8" />,
      title: t('voice_copilot.transcriptProcessing'),
    },
    analysis_done: {
      icon: <Check className="w-[1vw] h-[1vw] min-w-[12px] min-h-[12px] max-w-[16px] max-h-[16px]" color="#4ade80" />,
      title: t('voice_copilot.analysisDone'),
    },
  };

  const currentValue = values[status];

  return currentValue ? (
    <div className="flex gap-1 justify-center items-center font-medium">
      {currentValue.icon}
      <Text className="text-neutral-1 text-clamp-sm">
        {currentValue.title}
      </Text>
    </div>
  ) : null;
}

export default Status;
