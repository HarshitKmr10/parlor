import React, { useCallback, useState, useEffect } from "react";
import {
  CheckIcon,
  CopyIcon,
  Link2Icon,
  VideoIcon,
} from "@radix-ui/react-icons";
import { Box, Flex, Text } from "@radix-ui/themes";
import { useGlobalContext } from "contexts/store";
import { API } from "api";
import { PiPhoneDisconnectFill } from "react-icons/pi";
import useMeetingDetails from "hooks/useMeetingDetails";
import { useRouter } from "next/navigation";
import CreateTicketModal from "components/Modals/CreateTicketModal";
import CreateTicketSuccessModal from "components/Modals/CreateTicketSuccessModal";
import { MeetingStatus } from "./MeetingStatus";

interface P1CopilotCallingInfoProps {
  meetingId: string;
  channel?: string;
  title?: string;
  link?: string;
  duration?: string;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
}

function P1CopilotCallingInfo({
  meetingId,
  channel,
  title,
  link,
  duration,
  setStatus,
}: P1CopilotCallingInfoProps) {
  const { user, device } = useGlobalContext();
  const { status, loading, listenerId, error } = useMeetingDetails(meetingId);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [ticketLink, setTicketLink] = useState("");
  const router = useRouter();

  useEffect(() => {
    setStatus(status);
  }, [status]);

  const handleDisconnect = async () => {
    setIsDisconnecting(true);

    const disconnectPhone = async () => {
      try {
        console.log("P1 - Attempting to disconnect phone call");
        
        if (!device) {
          console.error("P1 - Device is not available");
          return;
        }
        
        const activeCalls = device.calls;
        console.log("P1 - Active calls:", activeCalls);
        
        if (activeCalls && Array.isArray(activeCalls) && activeCalls.length > 0) {
          // Get the first active call and disconnect it
          const activeCall = activeCalls[0];
          console.log("P1 - Disconnecting call:", activeCall);
          if (activeCall && typeof activeCall.disconnect === 'function') {
            await activeCall.disconnect();
            console.log("P1 - Call disconnected successfully");
          } else {
            console.error("P1 - Active call does not have disconnect method", activeCall);
          }
        } else {
          console.log("P1 - No active calls to disconnect");
        }
      } catch (e) {
        console.error(`P1 - Error in disconnecting call: ${e}`);
      }
    };

    const removeBot = async (botId: string) => {
      await API.Meetings.RemoveBot(botId, user);
    };

    try {
      if (channel === "Phone") {
        await disconnectPhone();
      } else {
        await removeBot(listenerId);
      }
    } catch (e) {
      console.error(`Error in handleDisconnect: ${e}`);
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (error) {
    throw error;
  }
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      className="items-center h-full border-b border-[var(--gray-8)] bg-[var(--gray-11)] w-full"
      px="4"
      py="4"
      gapX="2"
      gapY="6"
    >
      <Flex gapX="2" className="w-full">
        <Box className="w-full ">
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
                onClick={() => window.open(link, "_blank")}
                className="text-white cursor-pointer"
              >
                <Link2Icon className="text-white" />
                <Text as="div" size="2" weight="regular">
                  Meet Link
                </Text>
              </Flex>
            </Flex>
            {status && !loading ? (
              <MeetingStatus status={status || "loading"} channel={channel} />
            ) : null}
          </Flex>
          <Flex gapX="2" align="center" justify="between" className="w-full ">
            <Flex gapX="2" align="center" justify="between" className="w-full">
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
                    <Text size="2">{duration || "00:00"} min</Text>{" "}
                  </Flex>
                </Flex>
              </Flex>
              {status === "analysis_done" ? (
                <Flex gap="2" align="center">
                  <button
                    className="flex items-center justify-center gap-2 px-2 py-1 text-sm font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap"
                    onClick={() => setIsTicketModalOpen(true)}
                  >
                    Create Incident
                  </button>

                  <button
                    className="flex items-center justify-center gap-2 px-2 py-1 text-sm font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap"
                    onClick={() =>
                      router.push(`/p1/postcall?meetingId=${meetingId}`)
                    }
                  >
                    Postcall
                  </button>
                </Flex>
              ) : (
                <button
                  className="flex items-center justify-center gap-2 px-2 py-1 text-sm font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:hover:bg-[var(--gray-11)] disabled:hover:text-white"
                  onClick={handleDisconnect}
                  disabled={
                    !status ||
                    isDisconnecting ||
                    loading ||
                    status === "meeting_ended" ||
                    status === "loading" ||
                    status === "not_started" ||
                    status === "transcript_processing" ||
                    status === "analysis_done"
                  }
                >
                  <PiPhoneDisconnectFill />
                  <span>End Call</span>
                </button>
              )}
            </Flex>
          </Flex>
        </Box>
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
    </Flex>
  );
}

export default P1CopilotCallingInfo;
