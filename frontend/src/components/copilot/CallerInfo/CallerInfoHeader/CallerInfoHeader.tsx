/**
 * CallerInfoHeader Component
 * 
 * Displays the user name, contact information, and copy-to-clipboard functionality
 */

import React from "react";
import { CheckIcon, CopyIcon } from "@radix-ui/react-icons";
import { Flex, Text, IconButton } from "@radix-ui/themes";
import Status from "../../Status";
import { callerInfoHeaderStyles } from "./CallerInfoHeader.styles";

interface CallerInfoHeaderProps {
  /** User's full name */
  userName: string;
  /** User's phone number */
  userPhone: string;
  /** Meeting title */
  title: string;
  /** Meeting link */
  link: string;
  /** Call channel (Phone/Meet) */
  channel?: string;
  /** Copy state */
  isCopied: boolean;
  /** Meeting status */
  status?: string;
  /** Loading state */
  loading: boolean;
  /** Copy handler function */
  onCopyPhone: (textToCopy?: string) => void;
}

function CallerInfoHeader({
  userName,
  userPhone,
  title,
  link,
  channel,
  isCopied,
  status,
  loading,
  onCopyPhone,
}: CallerInfoHeaderProps) {
  return (
    <Flex
      gapX="2"
      align="center"
      className={callerInfoHeaderStyles.flex.header}
    >
      {/* User Name and Copy Section */}
      <Flex align="center" gapX="2" className={callerInfoHeaderStyles.flex.userSection}>
        <Text as="div" weight="medium" className={`${callerInfoHeaderStyles.text.userName} text-clamp-base`}>
          {channel === "Phone" ? userName : title}
        </Text>
        
        {/* Copy to Clipboard Section */}
        <Flex
          gapX="1"
          direction="row"
          align="center"
          className={callerInfoHeaderStyles.flex.copySection}
        >
          <IconButton
            size="1"
            aria-label="Copy phone number or link"
            variant="ghost"
            onClick={() => onCopyPhone()}
          >
            {isCopied ? (
              <CheckIcon className={`${callerInfoHeaderStyles.header.copyIconSuccess} w-[1vw] h-[1vw] min-w-[12px] min-h-[12px] max-w-[16px] max-h-[16px]`} />
            ) : (
              <CopyIcon className={`${callerInfoHeaderStyles.header.copyIcon} w-[1vw] h-[1vw] min-w-[12px] min-h-[12px] max-w-[16px] max-h-[16px]`} />
            )}
          </IconButton>
          <Text
            as="div"
            weight="medium"
            className={`${callerInfoHeaderStyles.text.copyText} text-clamp-sm`}
            onClick={() =>
              onCopyPhone(channel === "Phone" ? userPhone : link)
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
      
      {/* Status Indicator */}
      {status && !loading ? (
        <div className="flex-shrink-0">
          <Status status={status || "loading"} channel={channel} />
        </div>
      ) : null}
    </Flex>
  );
}

export default CallerInfoHeader;

