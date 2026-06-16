// PostCallCallingInfo.tsx

import React, { useState, useMemo, useCallback } from 'react';
import { CheckIcon, CopyIcon, PlusIcon } from '@radix-ui/react-icons';
import {
  Box, Flex, Text, IconButton, Button,
} from '@radix-ui/themes';
import { IoCallOutline } from 'react-icons/io5';
import { copyToClipboard } from 'utils/stringUtils';
import AudioPlayer from 'components/AudioPlayer';
import CustomAvatar from 'components/CustomAvatar';
import { useGlobalContext } from 'contexts/store';
import { calculateDuration } from 'utils/timeUtils';
import CreateTicketModal from 'components/Modals/CreateTicketModal';
import CreateTicketSuccessModal from 'components/Modals/CreateTicketSuccessModal';
import { VideoIcon } from 'lucide-react';

interface PostCallCallingInfoProps {
  userName: string;
  userPhone?: string;
  recordingUrl?: string | null;
  incomingOrOutgoing?: string;
  meetingStartTime?: string;
  meetingEndTime?: string;
  channel?: string;
  title?: string;
  link?: string;
  meetingId: string;
  userSysId?: string;
}

function PostCallCallingInfo({
  userName,
  userPhone,
  recordingUrl,
  incomingOrOutgoing,
  meetingStartTime,
  meetingEndTime,
  channel,
  title,
  link,
  meetingId,
  userSysId,
}: PostCallCallingInfoProps) {
  const [isCopied, setIsCopied] = useState(false);
  
  // Treat Cisco Webex as a phone-like channel for display purposes
  const isPhoneChannel = channel === 'Phone' || channel === 'Cisco Webex';
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [ticketLink, setTicketLink] = useState('');

  const duration = useMemo(() => {
    if (meetingStartTime && meetingEndTime) {
      return calculateDuration(meetingStartTime, meetingEndTime);
    }
    return '00:00 min';
  }, [meetingStartTime, meetingEndTime]);

  const handleCopyPhone = useCallback(
    (textToCopy?: string) => {
      try {
        let contentToCopy = textToCopy;
        if (!contentToCopy) {
          if (userPhone && isPhoneChannel) {
            contentToCopy = userPhone;
          } else if (link && channel === 'Meet') {
            contentToCopy = link;
          } else {
            console.error('No valid content to copy');
            return;
          }
        }

        copyToClipboard(contentToCopy);
        setIsCopied(true);

        setTimeout(() => setIsCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy content:', error);
      }
    },
    [userPhone, channel, link],
  );

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
                <Text as="div" size="4" weight="medium" className="text-white">
                  {title}
                </Text>
                <Flex
                  gapX="1"
                  dir="col"
                  align="center"
                  className="text-white cursor-pointer"
                >
                  <IconButton
                    size="1"
                    aria-label="Copy phone number or link"
                    variant="ghost"
                    onClick={() => handleCopyPhone()}
                  >
                    {isCopied ? (
                      <CheckIcon className="text-green-500 transition-all duration-300" />
                    ) : (
                      <CopyIcon className="text-white transition-all duration-300" />
                    )}
                  </IconButton>
                  <Text
                    as="div"
                    size="2"
                    weight="regular"
                    className="text-white cursor-pointer"
                    onClick={() => handleCopyPhone(isPhoneChannel ? userPhone : link)}
                  >
                    {isCopied
                      ? 'Copied!'
                      : isPhoneChannel
                        ? userPhone
                        : 'Copy link'}
                  </Text>
                </Flex>
              </Flex>
            </Flex>

            {/* <Flex gapX="2">
              <Flex gapX="2">
                {channel === "Phone" && (
                  <Flex gapX="1">
                    <IoCallOutline color="white" />
                    <Text
                      as="div"
                      size="1"
                      weight="regular"
                      className="text-white"
                    >
                      {incomingOrOutgoing}
                    </Text>
                  </Flex>
                )}
                <Flex gapX="1">
                  <Text as="div" size="1" weight="bold" className="text-white">
                    Duration
                  </Text>
                  <Text
                    as="div"
                    size="1"
                    weight="regular"
                    className="text-white"
                  >
                    {duration}
                  </Text>
                </Flex>
              </Flex>
            </Flex> */}
            <Flex gapX="2">
              <Flex align="center" gap="4" className="text-white">
                <Flex align="center" gap="2">
                  {isPhoneChannel ? (
                    <IoCallOutline color="white" />
                  ) : (
                    <VideoIcon />
                  )}

                  <Text size="2">
                    {isPhoneChannel ? incomingOrOutgoing : 'Online Meet'}
                  </Text>
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
        {/* <Flex className="w-full" align="center" gap="2">
          <AudioPlayer src={recordingUrl} />
          <button
            className="flex items-center justify-center gap-2 px-2 py-1 text-sm font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap"
            onClick={handleCreateTicket}
          >
            Create Incident
          </button>
        </Flex> */}
      </Flex>

      <CreateTicketModal
        open={isTicketModalOpen}
        setOpen={setIsTicketModalOpen}
        setTicketLink={setTicketLink}
        setIsSuccessModalOpen={setIsSuccessModalOpen}
        isUserLoading={false}
        userName={userName}
        userSysId={userSysId}
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

export default PostCallCallingInfo;
