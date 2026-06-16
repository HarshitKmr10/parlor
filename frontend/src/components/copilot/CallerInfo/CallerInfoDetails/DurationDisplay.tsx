/**
 * DurationDisplay Component
 * 
 * Displays call duration with automatic updates
 * Isolated to prevent parent re-renders from duration updates
 */

import React from "react";
import { Flex, Text } from "@radix-ui/themes";
import useMeetingDuration from "hooks/useMeetingDuration";
import { callerInfoDetailsStyles } from "./CallerInfoDetails.styles";

interface DurationDisplayProps {
  /** Meeting data object containing timestamps */
  meeting: any;
  /** Current meeting status */
  status: string | null;
}

function DurationDisplay({ meeting, status }: DurationDisplayProps) {
  const duration = useMeetingDuration(meeting, status);

  return (
    <Flex align="center" gap="2" className={callerInfoDetailsStyles.flex.duration}>
      <Text weight="bold" className={`${callerInfoDetailsStyles.text.duration} text-clamp-sm`}>
        Duration:
      </Text>
      <Text weight="bold" className={`${callerInfoDetailsStyles.text.duration} text-clamp-sm`}>
        {duration || "00:00"}
      </Text>
    </Flex>
  );
}

export default DurationDisplay;

