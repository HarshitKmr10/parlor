/**
 * EndCallDialog Component
 * 
 * Confirmation dialog for ending calls with loading state support
 */

import React from "react";
import { useTranslation } from 'react-i18next';
import {
  Button,
  AlertDialog,
  Flex,
  Spinner,
} from "@radix-ui/themes";

interface EndCallDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Function to handle dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Whether the call is currently disconnecting */
  isDisconnecting: boolean;
  /** Function to handle the actual call disconnection */
  onConfirmDisconnect: () => void;
}

function EndCallDialog({
  open,
  onOpenChange,
  isDisconnecting,
  onConfirmDisconnect,
}: EndCallDialogProps) {
  const { t } = useTranslation();
  
  const handleConfirmClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    await onConfirmDisconnect();
    onOpenChange(false);
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content className="text-clamp-sm">
        <AlertDialog.Title className="text-clamp-base">{t('voice_copilot.confirmEndCall')}</AlertDialog.Title>
        <AlertDialog.Description className="text-clamp-sm">
          {t('voice_copilot.areYouSureEndCall')}
        </AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray" className="text-clamp-sm">
              {t('voice_copilot.cancel')}
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button
              variant="solid"
              color="red"
              disabled={isDisconnecting}
              onClick={handleConfirmClick}
              className="text-clamp-sm"
            >
              {isDisconnecting ? (
                <Flex align="center" gap="2">
                  <Spinner size="1" /> {t('voice_copilot.ending')}
                </Flex>
              ) : (
                t('voice_copilot.endCall')
              )}
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

export default EndCallDialog;

