import React, { useCallback, useEffect, useState } from "react";
import { CheckIcon, CopyIcon, VideoIcon } from "@radix-ui/react-icons";
import {
  Box,
  Flex,
  Text,
  IconButton,
  Button,
  Dialog,
  ScrollArea,
  Skeleton,
  AlertDialog,
  Spinner,
} from "@radix-ui/themes";
import CustomAvatar from "components/CustomAvatar";
import { useGlobalContext } from "contexts/store";
import { IoCallOutline } from "react-icons/io5";
import { API } from "api";
import { PiPhoneDisconnectFill } from "react-icons/pi";
import useMeetingDetails from "hooks/useMeetingDetails";
import { useRouter } from "next/navigation";
import { copyToClipboard } from "utils/stringUtils";
import CreateTicketModal from "components/Modals/CreateTicketModal";
import CreateTicketSuccessModal from "components/Modals/CreateTicketSuccessModal";
import RichTextEditor from "components/TipTap/TipTap";
import { MeetingStatus } from "./MeetingStatus";
import { toast } from "react-toastify";
interface CopilotCallingInfoProps {
  userName: string;
  userPhone?: string;
  userSysId?: string;
  incomingOrOutgoing?: string;
  meetingId: string;
  channel?: string;
  title?: string;
  link?: string;
  type?: "Copilot" | "P1" | "KnowledgeAssist";
  duration?: string;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
}

function CopilotCallingInfo({
  userName,
  userSysId,
  userPhone = "",
  incomingOrOutgoing = "",
  meetingId,
  channel,
  title,
  link,
  type,
  duration,
  setStatus,
}: CopilotCallingInfoProps) {
  const { user, device } = useGlobalContext();
  const { status, loading, listenerId, error } = useMeetingDetails(meetingId);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isCopied, setIsCopied] = React.useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [ticketLink, setTicketLink] = useState("");
  const [isKbLoading, setIsKbLoading] = useState(false);
  const [kbContent, setKbContent] = useState("");
  const [isKbDialogOpen, setIsKbDialogOpen] = useState(false);
  const [showEndCallConfirm, setShowEndCallConfirm] = useState(false);

  const router = useRouter();

  useEffect(() => {
    setStatus(status);
  }, [status]);

  const handleKbDialogueOpen = () => {
    setIsKbDialogOpen(false);
    setKbContent("");
    setIsKbLoading(false);
  };

  const handleCreateKB = async () => {
    setIsKbLoading(true);
    setIsKbDialogOpen(true);
    try {
      const response = await API.KnowledgeAI.getKBforTransitionMeeting(
        meetingId
      );
      const data = await response.json();
      setKbContent(data);
    } catch (error) {
      console.error("Error creating KB:", error);
      // You can add error handling logic here, such as displaying an error message to the user
    } finally {
      setIsKbLoading(false);
    }
  };

  const disconnectCall = async () => {
    setIsDisconnecting(true);

    const disconnectPhone = async () => {
      try {
        console.log("Attempting to disconnect phone call", device);
        
        if (!device) {
          console.error("Device is not available");
          return;
        }
        
        const activeCalls = device?.calls;
        try {
          device.disconnectAll();
          toast.success("Call disconnected");
        } catch (error) {
          toast.error("No Active Calls to disconnect");
        }
        
        if (!device?.calls) toast.error("No Active Calls found !!");
        
        if (activeCalls && Array.isArray(activeCalls) && activeCalls.length > 0) {
          // Get the first active call and disconnect it
          const activeCall = activeCalls[0];
          console.log("Disconnecting call:", activeCall);
          if (activeCall && typeof activeCall.disconnect === 'function') {
            await activeCall.disconnect();
            console.log("Call disconnected successfully");
          } else {
            console.error("Active call does not have disconnect method", activeCall);
          }
        } else {
          console.log("No active calls to disconnect");
        }
      } catch (e) {
        console.error(`Error in disconnecting call: ${e}`);
      }
    };

    const removeBot = async (botId: string) => {
      await API.KnowledgeAI.removeKnowledgeAIMeeting(botId);
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

  const handleDisconnect = () => {
    setShowEndCallConfirm(true);
  };

  const handleCopyPhone = useCallback(
    (textToCopy?: string) => {
      try {
        let contentToCopy = textToCopy;
        if (!contentToCopy) {
          if (userPhone && channel === "Phone") {
            contentToCopy = userPhone;
          } else if (link && channel === "Meet") {
            contentToCopy = link;
          } else {
            console.error("No valid content to copy");
            return;
          }
        }

        copyToClipboard(contentToCopy);
        setIsCopied(true);

        setTimeout(() => setIsCopied(false), 2000);
      } catch (e) {
        console.error("Failed to copy content:", e);
      }
    },
    [userPhone, channel, link]
  );
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
            <Flex align="center" gapX="2">
              <Text as="div" size="4" weight="medium" className="text-white">
                {channel === "Phone" ? userName : title}
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
                  onClick={() =>
                    handleCopyPhone(channel === "Phone" ? userPhone : link)
                  }
                >
                  {isCopied
                    ? "Copied!"
                    : channel === "Phone"
                    ? userPhone
                    : "Copy link"}
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
                    {channel === "Phone" ? (
                      <IoCallOutline color="white" />
                    ) : (
                      <VideoIcon />
                    )}
                    <Text size="2">
                      {channel === "Phone" ? incomingOrOutgoing : "Online Meet"}
                    </Text>
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
                  {type === "KnowledgeAssist" ? (
                    <button
                      className="flex items-center justify-center gap-2 px-2 py-1 text-sm font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:hover:bg-[var(--gray-11)] disabled:hover:text-white"
                      onClick={() =>
                        router.push(
                          `postcall?meetingId=${meetingId}&tab=createKB`
                        )
                      }
                      disabled={isKbLoading}
                    >
                      Create Document
                    </button>
                  ) : (
                    <button
                      className="flex items-center justify-center gap-2 px-2 py-1 text-sm font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap"
                      onClick={() => setIsTicketModalOpen(true)}
                    >
                      Create Incident
                    </button>
                  )}

                  <button
                    className="flex items-center justify-center gap-2 px-2 py-1 text-sm font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap"
                    onClick={() =>
                      router.push(
                        `${
                          type === "Copilot"
                            ? "/postcall"
                            : type === "P1"
                            ? "/p1/postcall"
                            : "/knowledge/postcall"
                        }?meetingId=${meetingId}`
                      )
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
                    // || status === 'loading'
                    // || status === 'not_started'
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
      <Dialog.Root open={isKbDialogOpen} onOpenChange={handleKbDialogueOpen}>
        <Dialog.Content
          style={{
            maxWidth: 600,
            height: "80vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Dialog.Title>Create New Knowledge Article</Dialog.Title>

          <ScrollArea style={{ flex: 1 }}>
            <Box p="2">
              {/* <MarkDownText value={kbContent.trim()} /> */}
              {!isKbLoading && kbContent.length > 0 ? (
                <RichTextEditor
                  content={kbContent.trim()}
                  onChange={setKbContent}
                />
              ) : (
                <Flex direction="column" gap="2">
                  <Skeleton style={{ width: "80%", height: "24px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "100%", height: "16px" }} />
                  <Skeleton style={{ width: "90%", height: "16px" }} />
                  <Skeleton style={{ width: "80%", height: "16px" }} />
                </Flex>
              )}
            </Box>
          </ScrollArea>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button>Create Document</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
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
      <AlertDialog.Root
        open={showEndCallConfirm}
        onOpenChange={setShowEndCallConfirm}
      >
        <AlertDialog.Content>
          <AlertDialog.Title>Confirm End Call</AlertDialog.Title>
          <AlertDialog.Description>
            Are you sure you want to end the call?
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                variant="solid"
                color="red"
                disabled={isDisconnecting}
                onClick={async (e) => {
                  e.preventDefault();
                  await disconnectCall();
                  setShowEndCallConfirm(false);
                }}
              >
                {isDisconnecting ? (
                  <Flex align="center" gap="2">
                    <Spinner size="1" /> Ending...
                  </Flex>
                ) : (
                  "End Call"
                )}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Flex>
  );
}

export default CopilotCallingInfo;
