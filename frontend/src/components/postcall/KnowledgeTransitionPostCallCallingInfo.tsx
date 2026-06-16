import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link2Icon,
  VideoIcon,
} from '@radix-ui/react-icons';
import {
  Box,
  Flex,
  Text,
  Button,
  Dialog,
  ScrollArea,
  Skeleton,
} from '@radix-ui/themes';
import AudioPlayer from 'components/AudioPlayer';
import { calculateDuration } from 'utils/timeUtils';
import RichTextEditor from 'components/TipTap/TipTap';
import { API } from 'api';

interface PostCallCallingInfoProps {
  recordingUrl?: string | null;
  meetingStartTime?: string;
  meetingEndTime?: string;
  title?: string;
  link?: string;
  meetingId: string;
}

function KnowledgeTransitionPostCallCallingInfo({
  recordingUrl,
  meetingStartTime,
  meetingEndTime,
  title,
  link,
  meetingId,
}: PostCallCallingInfoProps) {
  const { t } = useTranslation();
  const [kbContent, setKbContent] = useState('');
  const [isKbDialogOpen, setIsKbDialogOpen] = useState(false);
  const [isKbLoading, setIsKbLoading] = useState(false);
  const [quizContent, setQuizContent] = useState('');
  const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false);
  const [isQuizLoading, setIsQuizLoading] = useState(false);

  const duration = useMemo(() => {
    if (meetingStartTime && meetingEndTime) {
      return calculateDuration(meetingStartTime, meetingEndTime);
    }
    return '00:00 min';
  }, [meetingStartTime, meetingEndTime]);

  const handleCreateKB = async () => {
    setIsKbLoading(true);
    setIsKbDialogOpen(true);
    try {
      const response = await API.KnowledgeAI.getKBforTransitionMeeting(meetingId);
      if (!response.ok) {
        throw new Error(t('knowledge_assist.failedToCreateKB'));
      }
      const data = await response.json();
      setKbContent(data);
    } catch (error) {
      console.error('Error creating KB:', error);
      setKbContent(t('knowledge_assist.failedToLoadKBContent'));
    } finally {
      setIsKbLoading(false);
    }
  };

  const handleGenerateQuiz = async () => {
    setIsQuizLoading(true);
    setIsQuizDialogOpen(true);
    try {
      const response = await API.KnowledgeAI.getKBQuizforTransitionMeeting(meetingId);
      if (!response.ok) {
        throw new Error(t('knowledge_assist.failedToGenerateQuiz'));
      }
      const data = await response.json();
      setQuizContent(data);
    } catch (error) {
      console.error('Error generating quiz:', error);
      setQuizContent(t('knowledge_assist.failedToLoadQuizContent'));
    } finally {
      setIsQuizLoading(false);
    }
  };

  return (
    <>
      <Flex
        direction="column"
        align="center"
        justify="center"
        className="items-center h-full border-b border-[var(--gray-8)] bg-[var(--gray-11)] w-full"
        px="4"
        py="4"
        gapX="2"
        gapY="3"
      >
        <Flex gapX="2" className="w-full">
          <Box className="w-full space-y-2">
            <Flex
              gapX="2"
              gapY="7"
              align="center"
              justify="between"
              className="w-full"
            >
              <Flex align="center" gapX="3">
                <Text as="div" size="4" weight="medium" className="text-white">
                  {title}
                </Text>
                <Flex
                  gapX="1"
                  dir="col"
                  align="center"
                  onClick={() => window.open(link, '_blank')}
                  className="text-white cursor-pointer"
                >
                  <Link2Icon className="text-white" />
                  <Text as="div" size="2" weight="regular">
                    {t('knowledge_assist.meetLink')}
                  </Text>
                </Flex>
              </Flex>
            </Flex>
            <Flex gapX="2">
              <Flex align="center" gap="4" className="text-white">
                <Flex align="center" gap="2">
                  <VideoIcon />
                  <Text size="2">{t('knowledge_assist.onlineMeet')}</Text>
                </Flex>
                <Flex align="center" gap="2">
                  <Text size="2" weight="medium">
                    {t('knowledge_assist.duration')}:
                  </Text>
                  <Text size="2">
                    {duration || '00:00'}
                    {' '}
                    min
                  </Text>
                  {' '}
                </Flex>
              </Flex>
            </Flex>
          </Box>
        </Flex>
        {/* <Flex className="w-full" align="center" gap="2">
          <AudioPlayer src={recordingUrl} />
          <Button onClick={handleCreateKB} disabled={isKbLoading}>
            {isKbLoading ? 'Creating KB...' : 'Create KB'}
          </Button>
          <Button onClick={handleGenerateQuiz} disabled={isQuizLoading}>
            {isQuizLoading ? 'Generating Quiz...' : 'Generate Quiz'}
          </Button>
        </Flex> */}
      </Flex>

      <Dialog.Root open={isKbDialogOpen} onOpenChange={setIsKbDialogOpen}>
        <Dialog.Content
          style={{
            maxWidth: 600,
            height: '80vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Dialog.Title>{t('knowledge_assist.createNewDocument')}</Dialog.Title>

          <ScrollArea style={{ flex: 1 }}>
            <Box p="2">
              {isKbLoading ? (
                <Flex direction="column" gap="2">
                  <Skeleton style={{ width: '80%', height: '24px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '90%', height: '16px' }} />
                  <Skeleton style={{ width: '80%', height: '16px' }} />
                </Flex>
              ) : (
                <RichTextEditor content={kbContent.trim()} onChange={setKbContent} />
              )}
            </Box>
          </ScrollArea>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                {t('knowledge_assist.cancel')}
              </Button>
            </Dialog.Close>
            <Button disabled={isKbLoading}>
              {isKbLoading ? t('knowledge_assist.creating') : t('knowledge_assist.createDocument')}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={isQuizDialogOpen} onOpenChange={setIsQuizDialogOpen}>
        <Dialog.Content
          style={{
            maxWidth: 600,
            height: '80vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Dialog.Title>{t('knowledge_assist.generatedQuiz')}</Dialog.Title>

          <ScrollArea style={{ flex: 1 }}>
            <Box p="2">
              {isQuizLoading ? (
                <Flex direction="column" gap="2">
                  <Skeleton style={{ width: '80%', height: '24px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '100%', height: '16px' }} />
                  <Skeleton style={{ width: '90%', height: '16px' }} />
                  <Skeleton style={{ width: '80%', height: '16px' }} />
                </Flex>
              ) : (
                <RichTextEditor content={quizContent.trim()} onChange={setQuizContent} />
              )}
            </Box>
          </ScrollArea>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                {t('knowledge_assist.close')}
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
}

export default KnowledgeTransitionPostCallCallingInfo;
