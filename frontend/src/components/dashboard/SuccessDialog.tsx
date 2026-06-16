import React from 'react';
import { Dialog, Flex, Button } from '@radix-ui/themes';

const SuccessDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}> = ({ open, onOpenChange, onClose }) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Content style={{ maxWidth: 450 }}>
      <Dialog.Title>Success</Dialog.Title>
      <Dialog.Description size="2">
        The article has been saved.
      </Dialog.Description>
      <Flex gap="3" mt="4" justify="end">
        <Dialog.Close>
          <Button variant="soft" onClick={onClose}>
            OK
          </Button>
        </Dialog.Close>
      </Flex>
    </Dialog.Content>
  </Dialog.Root>
);
export default SuccessDialog;
