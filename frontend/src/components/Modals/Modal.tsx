import * as Dialog from '@radix-ui/react-dialog';
import { Cross1Icon } from '@radix-ui/react-icons';
import { ReactNode } from 'react';

export default function Modal({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog.Root>
  );
}

function ModalContent({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/50" />
      <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-8 text-gray-900 shadow">
        <div className="flex items-center justify-between">
          <Dialog.Title className="text-xl">{title}</Dialog.Title>
          <Dialog.Close className="cursor-pointer text-gray-400 hover:text-gray-500">
            <button onClick={onClose}>
              <Cross1Icon />
            </button>
          </Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}

Modal.Button = Dialog.Trigger;
Modal.Close = Dialog.Close;
Modal.Content = ModalContent;
