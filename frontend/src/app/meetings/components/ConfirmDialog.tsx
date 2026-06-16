'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
}) => {
  const [busy, setBusy] = React.useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[400px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl transition-colors dark:bg-slate-900 dark:ring-1 dark:ring-slate-800">
          <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</Dialog.Title>
          {Boolean(description) && (
            <Dialog.Description className="mt-2 text-sm text-slate-600 dark:text-slate-400">{description}</Dialog.Description>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={busy}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                destructive
                  ? 'bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600'
                  : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
              }`}
            >
              {busy ? 'Working…' : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
