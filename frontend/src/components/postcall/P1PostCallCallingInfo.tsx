// PostCallCallingInfo.tsx

import React, { useState, useMemo, useCallback } from 'react';
import { Link2Icon, VideoIcon } from '@radix-ui/react-icons';
import {
  Box, Flex, Text,
} from '@radix-ui/themes';
import AudioPlayer from 'components/AudioPlayer';
import { calculateDuration } from 'utils/timeUtils';
import CreateTicketModal from 'components/Modals/CreateTicketModal';
import CreateTicketSuccessModal from 'components/Modals/CreateTicketSuccessModal';

interface P1PostCallCallingInfoProps {

  recordingUrl?: string | null;
  meetingStartTime?: string;
  meetingEndTime?: string;
  title?: string;
  link?: string;
  meetingId: string;
}

function P1PostCallCallingInfo({
  recordingUrl,
  meetingStartTime,
  meetingEndTime,
  title,
  link,
  meetingId,
}: P1PostCallCallingInfoProps) {
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [ticketLink, setTicketLink] = useState('');

  const duration = useMemo(() => {
    if (meetingStartTime && meetingEndTime) {
      return calculateDuration(meetingStartTime, meetingEndTime);
    }
    return '00:00';
  }, [meetingStartTime, meetingEndTime]);

  const handleCreateTicket = () => {
    setIsTicketModalOpen(true);
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
                <Text
                  as="div"
                  size="4"
                  weight="medium"
                  className="text-white"
                >
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
                    Meet Link
                  </Text>
                </Flex>
              </Flex>

            </Flex>
            <Flex gapX="2">
              <Flex align="center" gap="4" className="text-white">
                <Flex align="center" gap="2">
                  <VideoIcon />
                  <Text size="2">Online Meet</Text>
                </Flex>
                <Flex align="center" gap="2">
                  <Text size="2" weight="medium">
                    Duration:
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
        <Flex className="w-full" align="center" gap="2">
          <AudioPlayer src={recordingUrl} />
          <button
            className="flex items-center justify-center gap-2 px-2 py-1 text-sm font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap"
            onClick={handleCreateTicket}
          >
            Create Incident
          </button>
        </Flex>
      </Flex>

      <CreateTicketModal
        open={isTicketModalOpen}
        setOpen={setIsTicketModalOpen}
        setTicketLink={setTicketLink}
        setIsSuccessModalOpen={setIsSuccessModalOpen}
        isUserLoading={false}
        userName=""
        userSysId=""
        meetingId={meetingId}
      />

      <CreateTicketSuccessModal
        open={isSuccessModalOpen}
        setOpen={setIsSuccessModalOpen}
        ticketLink={ticketLink}
      />
    </>
  );
}

export default P1PostCallCallingInfo;
