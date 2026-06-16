import React from 'react';
import Modal from 'react-modal';
import { Button } from '@radix-ui/themes';

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
  ticketLink: string;
};

function CreateTicketSuccessModal({ open, setOpen, ticketLink }: Props) {
  return (
    <Modal
      isOpen={open}
      onRequestClose={() => setOpen(false)}
      className="relative top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1/3 bg-white dark:bg-navy-700 p-5 rounded-2xl shadow-lg overflow-y-auto"
      contentLabel="Ticket Created Successfully"
    >
      <h1 className="text-xl font-semibold dark:text-white">
        Ticket Created Successfully!
      </h1>
      <p className="mt-4 dark:text-white">
        Your ticket has been created successfully. You can view it at the link
        below:
      </p>
      <a
        href={ticketLink}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-blue-500 hover:text-blue-600"
      >
        View Ticket
      </a>
      <div className="mt-4">
        <Button onClick={() => setOpen(false)} color="iris" className="py-1 px-2 cursor-pointer rounded-none">
          Close
        </Button>
      </div>
    </Modal>
  );
}

export default CreateTicketSuccessModal;
