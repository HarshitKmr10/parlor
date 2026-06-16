/**
 * CallerInfoActions Component
 * 
 * Displays action buttons based on call status and type
 */

import React from "react";
import { Flex } from "@radix-ui/themes";
import { PiPhoneDisconnectFill } from "react-icons/pi";
import { callerInfoActionsStyles } from "./CallerInfoActions.styles";

interface CallerInfoActionsProps {
  /** Call status */
  status?: string;
  /** Component type */
  type?: "Copilot" | "P1" | "KnowledgeAssist";
  /** Meeting ID */
  meetingId: string;
  /** Disconnection state */
  isDisconnecting: boolean;
  /** Loading state */
  loading: boolean;

  /** Navigation function */
  onNavigate: (path: string) => void;
  /** Disconnect handler */
  onDisconnect: () => void;
  /** Open ticket modal handler */
  onOpenTicketModal: () => void;
}

function CallerInfoActions({
  status,
  type,
  meetingId,
  isDisconnecting,
  loading,
  onNavigate,
  onDisconnect,
  onOpenTicketModal,
}: CallerInfoActionsProps) {
  // Action buttons for when analysis is done
  if (status === "analysis_done") {
    return (
      <Flex gap="2" align="center" className={callerInfoActionsStyles.flex.actions}>
          {/* <button
            className={callerInfoActionsStyles.actions.createIncident}
            onClick={onOpenTicketModal}
          >
            Create Ticket
          </button> */}
        {/* Postcall Button */}
        <button
          className={callerInfoActionsStyles.actions.postcall}
          onClick={() =>
            onNavigate(
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
    );
  }

  // End Call button for other statuses
  return (
    <button
      className={callerInfoActionsStyles.actions.endCall}
      onClick={onDisconnect}
      disabled={
        !status ||
        isDisconnecting ||
        loading ||
        status === "meeting_ended" ||
        status === "transcript_processing" ||
        status === "analysis_done"
      }
    >
      <PiPhoneDisconnectFill className="w-[1vw] h-[1vw] min-w-[12px] min-h-[12px] max-w-[16px] max-h-[16px]" />
      <span>End Call</span>
    </button>
  );
}

export default CallerInfoActions;

