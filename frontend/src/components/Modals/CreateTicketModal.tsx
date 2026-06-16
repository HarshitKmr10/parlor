import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import {
  Button, DropdownMenu, Flex, Text,
} from '@radix-ui/themes';
import clsx from 'clsx';
import InputField from 'components/fields/InputField';
import TextField from 'components/fields/TextField';
import Spinner from 'components/spinner/spinner';
import { useGlobalContext } from 'contexts/store';
import { ChevronUpIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import usePostcallDetails from 'hooks/usePostcallDetails';

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
  setTicketLink: (link: string) => void;
  setIsSuccessModalOpen: (open: boolean) => void;
  isUserLoading?: boolean;
  userName?: string;
  userSysId?: string;
  meetingId: string;
};

const allowedUrgencyValues = [
  { label: '1 - High', value: '1' },
  { label: '2 - Medium', value: '2' },
  { label: '3 - Low', value: '3' },
];

const allowedImpactValues = [
  { label: '1 - High', value: '1' },
  { label: '2 - Medium', value: '2' },
  { label: '3 - Low', value: '3' },
];

function CreateTicketModal({
  open,
  setOpen,
  setTicketLink,
  setIsSuccessModalOpen,
  isUserLoading,
  userName,
  userSysId,
  meetingId,
}: Props) {
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState('1');
  const [impact, setImpact] = useState('1');
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [urgencyMenuOpen, setUrgencyMenuOpen] = useState(false);
  const [impactMenuOpen, setImpactMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const { user } = useGlobalContext();
  const {
    summaryData,
    isLoadingDetails,
    isLoadingChat,
    // error: postcallDetailsError,
  } = usePostcallDetails(open ? meetingId : null);

  // Validation functions
  const validateTitle = (title: string): string | null => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 5) {
      return 'Title must be at least 5 characters long';
    }
    if (trimmedTitle.length > 100) {
      return 'Title must not exceed 100 characters';
    }
    return null;
  };

  const validateDescription = (desc: string): string | null => {
    const trimmedDesc = desc.trim();
    if (trimmedDesc.length < 5) {
      return 'Description must be at least 5 characters long';
    }
    return null;
  };

  const isFormValid = (): boolean => {
    const titleValidation = validateTitle(shortDescription);
    const descValidation = validateDescription(description);
    return !titleValidation && !descValidation;
  };

  const generateShortDescription = async (longDescription: string) => {
    try {
      const response = await fetch('/api/createDescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: longDescription }),
      });
      if (!response.ok) {
        console.error('Failed to fetch from /api/createDescription', response);
      }
      const data = await response.json();

      if (data.response && data.response.content) {
        const content = JSON.parse(data.response.content);

        if (
          content.shortDescription
          && content.urgency
          && content.impactScore
        ) {
          setShortDescription(content.shortDescription);
          setUrgency(content.urgency);
          setImpact(content.impactScore);
        } else {
          console.error('Parsed content missing required fields', content);
          // throw new Error('Parsed content missing required fields');
        }
      }
    } catch (e) {
      setError('Error generating short description');
      setShortDescription('Error generating short description');
      setUrgency('1');
    }
  };

  useEffect(() => {
    if (open && summaryData) {
      setDescription(summaryData);
      generateShortDescription(summaryData);
    }
  }, [open, summaryData]);

  useEffect(() => {
    if (!open) {
      // Clear form when modal closes
      setShortDescription('');
      setDescription('');
      setUrgency('1');
      setImpact('1');
      setError(null);
      setTitleError(null);
      setDescriptionError(null);
    }
  }, [open]);

  if (!open) return null;

  // if (postcallDetailsError) {
  //   throw postcallDetailsError;
  // }

  const handleShortDescriptionChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value;
    setShortDescription(value);
    
    // Validate title and set error
    const validationError = validateTitle(value);
    setTitleError(validationError);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDescription(value);
    
    // Validate description and set error
    const validationError = validateDescription(value);
    setDescriptionError(validationError);
  };

  const handleUrgencyChange = (value: string) => {
    setUrgency(value);
  };

  const handleImpactChange = (value: string) => {
    setImpact(value);
  };

  const handleSubmit = async () => {
    // Validate form before submitting
    if (!isFormValid()) {
      setError('Please fix the validation errors before submitting');
      return;
    }

    setCreatingTicket(true);
    try {
      const ticketData = {
        subject: shortDescription.trim(), // Trim before sending
        description: description.trim(), // Trim before sending
        urgency,
        impact,
        userSysId,
        user,
      };
      const response = await fetch('/api/createTicket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketData),
      });
      const data = await response.json();
      if (response.ok) {
        setTicketLink(data.ticketLink);
        setOpen(false);
        setIsSuccessModalOpen(true);
      } else {
        console.error('Failed to create incident', response);
      }
    } catch (e) {
      setError(`Error creating incident: ${e.message}`);
    } finally {
      setCreatingTicket(false);
    }
  };

  const isLoading = isLoadingDetails || isLoadingChat || isUserLoading;

  return (
    <Modal
      isOpen={open}
      onRequestClose={() => setOpen(false)}
      className={clsx(
        'relative top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1/2 bg-white dark:bg-navy-700 p-5 rounded-2xl shadow-lg',
        {
          'max-h-[75vh] overflow-y-auto': !isLoading,
          'h-[300px] flex items-center justify-center': isLoading,
        },
      )}
      contentLabel="Ticket Creation Form"
    >
      <button
        onClick={() => setOpen(false)}
        className="absolute top-0 right-0 p-4"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 stroke-textColor-light dark:stroke-textColor-dark"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-full text-textColor-light dark:text-textColor-dark">
          <Spinner />
        </div>
      ) : error ? (
        <div className="text-red-500">
          Error:
          {error}
        </div>
      ) : (
        <div className="flex flex-col justify-between h-full">
          <div>
            <Flex direction="column" gapY="1" py="2">
              <InputField
                id="shortDescription"
                name="shortDescription"
                value={shortDescription}
                disabled={creatingTicket}
                onChange={handleShortDescriptionChange}
                placeholder="Enter a short description"
                label="Title"
                required
              />
              {!!titleError && (
                <Text size="1" className="mt-1  text-red-500">
                  {titleError}
                </Text>
              )}
            </Flex>
            {!!userName && (
              <Flex direction="column" gapY="1" py="2">
                <InputField
                  id="userName"
                  name="userName"
                  value={userName}
                  disabled
                  placeholder="Enter a Caller Name"
                  label="Caller Name"
                  extra="mt-2"
                />
              </Flex>
            )}
            <div className="my-3 flex w-full gap-4 flex-wrap md:flex-nowrap justify-between">
              <Flex direction="column" gapY="1" py="2" className="w-full">
                <Text size="4" style={{ color: 'var(--gray-9)' }} weight="bold">
                  Urgency
                </Text>
                <DropdownMenu.Root onOpenChange={setUrgencyMenuOpen}>
                  <DropdownMenu.Trigger className="p-2 rounded-md outline outline-offset-3 outline-[1.5px] outline-[var(--gray-7)]">
                    <Button
                      variant="outline"
                      className="justify-between w-full"
                    >
                      {allowedUrgencyValues.find((u) => u.value === urgency)
                        ?.label || 'Select urgency'}
                      {urgencyMenuOpen ? (
                        <ChevronUpIcon />
                      ) : (
                        <ChevronDownIcon />
                      )}
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content className="w-[var(--radix-dropdown-menu-trigger-width)]" style={{ zIndex: 9999 }}>
                    {allowedUrgencyValues.map((option) => (
                      <DropdownMenu.Item
                        key={option.value}
                        onSelect={() => handleUrgencyChange(option.value)}
                      >
                        {option.label}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </Flex>

              <Flex direction="column" gapY="1" py="2" className="w-full">
                <Text size="4" style={{ color: 'var(--gray-9)' }} weight="bold">
                  Impact
                </Text>
                <DropdownMenu.Root onOpenChange={setImpactMenuOpen}>
                  <DropdownMenu.Trigger className="p-2 rounded-md outline outline-offset-3 outline-[1.5px] outline-[var(--gray-7)]">
                    <Button
                      variant="outline"
                      className="justify-between w-full"
                    >
                      {allowedImpactValues.find((i) => i.value === impact)
                        ?.label || 'Select impact'}
                      {impactMenuOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content className="w-[var(--radix-dropdown-menu-trigger-width)]" style={{ zIndex: 9999 }}>
                    {allowedImpactValues.map((option) => (
                      <DropdownMenu.Item
                        key={option.value}
                        onSelect={() => handleImpactChange(option.value)}
                      >
                        {option.label}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </Flex>
            </div>

            <Flex direction="column" gapY="1" py="2">
              <TextField
                id="description"
                name="description"
                value={description}
                disabled={creatingTicket}
                onChange={handleDescriptionChange}
                placeholder="Enter a detailed description"
                rows={10}
                label="Description"
                required
              />
              {!!descriptionError && (
                <Text size="1" className="mt-1 text-red-500">
                  {descriptionError}
                </Text>
              )}
            </Flex>
          </div>
          <div className="flex justify-end mt-4">
            <Button
              onClick={handleSubmit}
              color="iris"
              disabled={isLoading || creatingTicket || !isFormValid()}
              className="py-1 px-2 cursor-pointer rounded-none"
            >
              {creatingTicket ? 'Creating Incident...' : 'Create Incident'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default CreateTicketModal;
