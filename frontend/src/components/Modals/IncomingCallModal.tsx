import React, { useState, useEffect } from "react";
import { Text, Button, Avatar, Flex } from "@radix-ui/themes";
import * as Dialog from "@radix-ui/react-dialog";
import { useGlobalContext } from "contexts/store";
import { useRouter } from "next/navigation";
import { API } from "api";
import { Device, Call } from "@twilio/voice-sdk";

function IncomingCallModal({ device }: { device: Device }) {
  const [call, setCall] = useState<Call | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { user, selectedTeam } = useGlobalContext();
  const router = useRouter();

  useEffect(() => {
    if (!device) {
      return;
    }

    const onDeviceReady = () => {
      console.log();
    };
    const onIncomingCall = (incomingCall: Call) => {
      setIsOpen(true);
      setCall(incomingCall);
    };

    device.on("registered", onDeviceReady);
    device.on("incoming", onIncomingCall);

    return () => {
      device.off("registered", onDeviceReady);
      device.off("incoming", onIncomingCall);
    };
  }, [device]);

  const handleAccept = async () => {
    if (!call) {
      console.error("No call to accept");
      return;
    }
    try {
      await call.accept();
      setIsOpen(false);
      
      let meetingId = null;
      try {
        meetingId = call.customParameters?.get("meeting_id");
      } catch (error) {
        console.error("Error accessing customParameters:", error);
      }
      
      if (meetingId) {
        await API.Teams.CreateIntakeMeeting(user, meetingId, selectedTeam);
        router.push(`/copilot?meetingId=${meetingId}`);
      } else {
        console.error("No meeting ID found in call parameters");
      }
    } catch (error) {
      console.error(`Error handling accept: ${error}`);
    }
  };

  const handleReject = () => {
    if (!call) {
      console.error("No call to reject");
      return;
    }
    try {
      call.reject();
      setIsOpen(false);
    } catch (error) {
      console.error("Error rejecting call:", error);
    }
  };

  return (
    <Dialog.Root open={isOpen} modal={false}>
      <Dialog.Content className="fixed right-[10px] bottom-[10px] border border-[#B0B5BF] border-l-4  w-[350px] rounded-md  pb-2 shadow  pl-2 z-50 bg-white dark:bg-[var(--gray-11)]">
        <Flex justify="start" align="center" gap="2" py="2">
          <Avatar
            src="https://cdn-icons-png.flaticon.com/512/3177/3177440.png"
            fallback="?"
            radius="full"
            size="4"
          />
          <Text as="p" size="4" weight="regular" className="ml-2">
            {call?.parameters?.From || call?.customParameters?.get?.("From") || "Unknown Caller"}
          </Text>
        </Flex>
        <Flex ml="9" className="" gap="2">
          <Button onClick={handleAccept} variant="solid" size="3">
            Answer
          </Button>
          <Button size="3" variant="outline" onClick={handleReject} color="red">
            Decline
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default React.memo(IncomingCallModal);
