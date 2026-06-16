import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  BounceLoader as LiveIcon,
  ScaleLoader as ProcessingIcon,
} from 'react-spinners';
import { TiTick as DoneIcon } from 'react-icons/ti';
import { Text } from '@radix-ui/themes';

export function MeetingStatus({ status, channel }) {
  const { t } = useTranslation();
  const values = {
    loading: {
      icon: null,
      title: t('voice_copilot.loading'),
    },
    not_started: {
      icon: <LiveIcon size={10} color="#fbbf24" />,
      title: t('voice_copilot.notStarted', { channel }),
    },
    meeting_initiated: {
      icon: <LiveIcon size={10} color="#fbbf24" />,
      title: t('voice_copilot.initiated', { channel }),
    },
    meeting_started: {
      icon: <LiveIcon size={10} color="#f00" />,
      title: t('voice_copilot.inProgress', { channel }),
    },
    meeting_ended: {
      icon: <ProcessingIcon height={10} width={2} color="#818cf8" />,
      title: t('voice_copilot.ended', { channel }),
    },
    transcript_processing: {
      // icon: <LiveIcon size={14} color="#818cf8" />,
      icon: <ProcessingIcon height={10} width={2} color="#818cf8" />,
      title: t('voice_copilot.transcriptProcessing'),
    },
    analysis_done: {
      icon: <DoneIcon size={24} color="#4ade80" />,
      title: t('voice_copilot.analysisDone'),
    },
  };

  const currentValue = values[status];

  return currentValue ? (
    <div className="flex gap-2 justify-center items-center font-medium">
      {currentValue.icon}
      <Text size="2" className="text-white">
        {currentValue.title}
      </Text>
    </div>
  ) : null;
}
