/**
 * CallerInfoModals Component
 * 
 * Contains all modal dialogs for the CallerInfo component
 */

import React from "react";
import {
  Button,
  Dialog,
  ScrollArea,
  Skeleton,
  AlertDialog,
  Spinner,
  Flex,
  Box,
} from "@radix-ui/themes";
import CreateTicketModal from "components/Modals/CreateTicketModal";
import CreateTicketSuccessModal from "components/Modals/CreateTicketSuccessModal";
import RichTextEditor from "components/TipTap/TipTap";
import { callerInfoModalsStyles } from "./CallerInfoModals.styles";

interface CallerInfoModalsProps {
  /** Knowledge base dialog state */
  isKbDialogOpen: boolean;
  /** Knowledge base content */
  kbContent: string;
  /** Knowledge base loading state */
  isKbLoading: boolean;
  /** Meeting ID */
  meetingId: string;
  /** Ticket modal state */
  isTicketModalOpen: boolean;
  /** Ticket link */
  ticketLink: string;
  /** Success modal state */
  isSuccessModalOpen: boolean;
  /** End call confirmation state */
  showEndCallConfirm: boolean;
  /** Disconnection state */
  isDisconnecting: boolean;
  /** KB dialog close handler */
  onKbDialogClose: () => void;
  /** KB content change handler */
  onKbContentChange: (content: string) => void;
  /** Ticket modal handlers */
  onTicketModalOpenChange: (open: boolean) => void;
  onTicketLinkChange: (link: string) => void;
  onSuccessModalOpenChange: (open: boolean) => void;
  /** End call confirmation handlers */
  onEndCallConfirmChange: (show: boolean) => void;
  onConfirmDisconnect: () => void;
}

function CallerInfoModals({
  isKbDialogOpen,
  kbContent,
  isKbLoading,
  meetingId,
  isTicketModalOpen,
  ticketLink,
  isSuccessModalOpen,
  showEndCallConfirm,
  isDisconnecting,
  onKbDialogClose,
  onKbContentChange,
  onTicketModalOpenChange,
  onTicketLinkChange,
  onSuccessModalOpenChange,
  onEndCallConfirmChange,
  onConfirmDisconnect,
}: CallerInfoModalsProps) {
  return (
    <>
      {/* Knowledge Base Creation Dialog */}
      <Dialog.Root open={isKbDialogOpen} onOpenChange={onKbDialogClose}>
        <Dialog.Content
          style={callerInfoModalsStyles.modals.kbDialog}
        >
          <Dialog.Title>Create New Knowledge Article</Dialog.Title>

          <ScrollArea style={{ flex: 1 }}>
            <Box p="2">
              {!isKbLoading && kbContent.length > 0 ? (
                <RichTextEditor
                  content={kbContent.trim()}
                  onChange={onKbContentChange}
                />
              ) : (
                // Loading skeleton
                <Flex direction="column" gap="2" className={callerInfoModalsStyles.modals.skeleton.container}>
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.title} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line90} />
                  <Skeleton style={callerInfoModalsStyles.modals.skeleton.line80} />
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

      {/* Ticket Creation Modal */}
      <CreateTicketModal
        open={isTicketModalOpen}
        setOpen={onTicketModalOpenChange}
        setTicketLink={onTicketLinkChange}
        setIsSuccessModalOpen={onSuccessModalOpenChange}
        isUserLoading={false}
        userName=""
        userSysId=""
        meetingId={meetingId}
      />

      {/* Ticket Creation Success Modal */}
      <CreateTicketSuccessModal
        open={isSuccessModalOpen}
        setOpen={onSuccessModalOpenChange}
        ticketLink={ticketLink}
      />

      {/* End Call Confirmation Dialog */}
      <AlertDialog.Root
        open={showEndCallConfirm}
        onOpenChange={onEndCallConfirmChange}
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
                onClick={onConfirmDisconnect}
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
    </>
  );
}

export default CallerInfoModals;

