/**
 * CallerInfoDetails Component
 * 
 * Displays call type indicator and duration information
 */

import React from "react";
import { VideoIcon } from "@radix-ui/react-icons";
import { Flex, Text } from "@radix-ui/themes";
import { MdOutlineCall } from "react-icons/md";
import { callerInfoDetailsStyles } from "./CallerInfoDetails.styles";
import DurationDisplay from "./DurationDisplay";

interface CallerInfoDetailsProps {
  /** Call channel (Phone/Meet) */
  channel?: string;
  /** Call direction (Incoming/Outgoing) */
  incomingOrOutgoing: string;
  /** Meeting data object containing timestamps */
  meeting: any;
  /** Current meeting status */
  status: string | null;
}

function CallerInfoDetails({
  channel,
  incomingOrOutgoing,
  meeting,
  status,
}: CallerInfoDetailsProps) {
  return (
    <Flex gapX="2" className={callerInfoDetailsStyles.flex.callInfo}>
      <Flex align="center" gap="4" className={callerInfoDetailsStyles.details.callInfo}>
        {/* Call Type Indicator */}
        <Flex align="center" className={callerInfoDetailsStyles.flex.callType}>
          {channel === "Phone" ? (
          <MdOutlineCall className="w-[1vw] h-[1vw] min-w-[12px] min-h-[12px] max-w-[16px] max-h-[16px]" color="white" />
          ) : (
            <VideoIcon className="w-[1vw] h-[1vw] min-w-[12px] min-h-[12px] max-w-[16px] max-h-[16px]" color="white" />
          )}
          <Text weight="medium" className={`${callerInfoDetailsStyles.text.callType} text-clamp-sm`}>
            {channel === "Phone" ? incomingOrOutgoing : "Online Meet"}
          </Text>
        </Flex>
        
        {/* Duration Display */}
        <DurationDisplay meeting={meeting} status={status} />
      </Flex>
    </Flex>
  );
}

export default CallerInfoDetails;

