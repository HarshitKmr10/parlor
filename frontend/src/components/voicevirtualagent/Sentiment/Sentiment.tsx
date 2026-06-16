import React, { useRef, useState } from 'react';
import { Box, Flex, Text, Badge, Separator, IconButton } from '@radix-ui/themes';
import { PlayIcon, PauseIcon } from 'lucide-react';
import AIChatIcon from '@/components/icons/AIChatIcon';
import { usePostcallSentiment } from '@/hooks/voice-virtial-agent/useSentiment';
import MarkDownText from '@/components/MarkDownText/MarkDownText';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

interface Props {
  meetingId?: string;
  agentName?: string;
}

const Sentiment = ({ meetingId, agentName }: Props) => {
  const { t } = useTranslation();
  const { data, loading, error } = usePostcallSentiment(meetingId);
  const aiLabel = agentName || t('voice_virtual_agent.coResolveFromServicedeskAI');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error('Audio playback error:', err);
          toast.error(t('voice_virtual_agent.audioFailedToPlayCheckRecording'));
          setIsPlaying(false);
        });
    }
  };

  if (error) return null;

  const SkeletonLoader = () => (
    <Flex direction="column" gap="2" mt="2" mr="4" className="w-full">
      {[...Array(3)].map((_, index) => (
        <div
          key={index}
          className="loading-skeleton"
          style={{
            width: '100%',
            height: '16px',
            backgroundColor: 'var(--accent-4)',
            borderRadius: 'var(--radius-2)',
          }}
        />
      ))}
    </Flex>
  );

  return (
    <Box className="dark:bg-neutral.alpha space-y-6 rounded-md border border-[var(--accent-3)] bg-white p-4">
      {/* Audio Player */}
      {!!data?.recording_file && (
        <>
          <Box className="rounded-lg border border-gray-300 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
            <Flex align="center" gap="3">
              <IconButton
                onClick={togglePlayback}
                variant="solid"
                color="gray"
                className="h-9 w-9 cursor-pointer"
              >
                {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
              </IconButton>

              <Box className="min-w-0 flex-1">
                <Text size="2" weight="medium" className="truncate text-gray-900 dark:text-white">
                  {t('voice_virtual_agent.audioRecording')}
                </Text>
                <Box className="relative mt-1 h-1 w-full rounded bg-gray-300 dark:bg-gray-700">
                  <Box
                    className="absolute left-0 top-0 h-1 rounded bg-[var(--accent-9)]"
                    style={{
                      width: audioRef.current
                        ? `${(audioRef.current.currentTime / audioRef.current.duration) * 100 || 0}%`
                        : '0%',
                    }}
                  />
                </Box>
              </Box>

              <audio
                ref={audioRef}
                src={data.recording_file}
                onEnded={() => setIsPlaying(false)}
                onTimeUpdate={() => {}}
                onError={() => {
                  toast.error(t('voice_virtual_agent.audioFailedToPlayTryAgain'));
                  setIsPlaying(false);
                }}
                hidden
              />
            </Flex>
          </Box>
          <Separator my="2" className="w-full" />
        </>
      )}

      {/* AI Summary and Sentiment */}
      <Flex gap="3" align="start">
        <Box mt="1">
          <AIChatIcon />
        </Box>
        <Flex direction="column" className="w-full" gap="4">
          <Flex align="center" gap="2">
            <Text size="2" weight="bold" className="text-[var(--pink-9)]">
              {aiLabel}
            </Text>
            <Badge>{t('voice_virtual_agent.aiGenerated')}</Badge>
          </Flex>

          {/* Summary */}
          {loading ? (
            <SkeletonLoader />
          ) : (
            !!data?.summary && (
              <Box>
                <Text size="2" weight="bold" className="mb-2 block">
                  {t('voice_virtual_agent.summary')}
                </Text>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <MarkDownText value={data.summary} />
                </div>
              </Box>
            )
          )}

          <Separator my="2" className="w-full" />

          {/* Sentiment */}
          {loading ? (
            <SkeletonLoader />
          ) : (
            !!data?.sentiment && (
              <Box>
                <Text size="2" weight="bold" className="mb-2 block">
                  {t('voice_virtual_agent.sentiment')}
                </Text>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <MarkDownText value={data.sentiment} />
                </div>
              </Box>
            )
          )}

          <Separator my="2" />

          {/* Meta Info */}
          <Box className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            {!!data?.status && (
              <Flex gap="2">
                <Text className="text-gray-500 dark:text-gray-300">{t('voice_virtual_agent.status')}</Text>
                <Box className="font-medium text-gray-900 dark:text-white">{data.status}</Box>
              </Flex>
            )}

            {!!data?.user_name && (
              <Flex gap="2">
                <Text className="text-gray-500 dark:text-gray-300">{t('voice_virtual_agent.user')}</Text>
                <Box className="font-medium text-gray-900 dark:text-white">{data.user_name}</Box>
              </Flex>
            )}

            {!!data?.called_at && (
              <Flex gap="2">
                <Text className="text-gray-500 dark:text-gray-300">{t('voice_virtual_agent.calledAt')}</Text>
                <Box className="font-medium text-gray-900 dark:text-white">{data.called_at}</Box>
              </Flex>
            )}

            {!!data?.created_at && (
              <Flex gap="2">
                <Text className="text-gray-500 dark:text-gray-300">{t('voice_virtual_agent.createdAt')}</Text>
                <Box className="font-medium text-gray-900 dark:text-white">
                  {new Date(data.created_at).toLocaleString()}
                </Box>
              </Flex>
            )}
          </Box>
        </Flex>
      </Flex>
    </Box>
  );
};

export default Sentiment;
