import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import {
  Box,
  Button, Flex, Text,
} from '@radix-ui/themes';
import clsx from 'clsx';
import TextInput from 'components/TextInput';
import Spinner from 'components/spinner/spinner';
import usePostcallDetails from 'hooks/usePostcallDetails';
import PillDropDown, { DropdownItem } from '@/components/PillDropDown';
import { useCopilotStore } from 'store/Copilot';
import CategoryIcon from '@/components/icons/CategoryIcon';
import PriorityIcon from '@/components/icons/PriorityIcon';
import UrgencyIcon from '@/components/icons/UrgencyIcon';
import ImpactIcon from '@/components/icons/ImpactIcon';

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
  meetingId: string;
  prefilledTitle?: string;
  prefilledDescription?: string;
  prefilledCategory?: string;
  prefilledPriority?: string;
  prefilledUrgency?: string;
  prefilledImpact?: string;
  prefilledWorkNotes?: string;
  viewOnly?: boolean;
  ticketNumber?: string;
  ticketCreatedUpdated?: (created: boolean) => void;
  onTicketUpdated?: () => void;
};

const allowedCategoryValues: DropdownItem[] = [
  { id: 1, title: 'network' },
  { id: 2, title: 'hardware' },
  { id: 3, title: 'software' },
  { id: 4, title: 'inquiry' },
  { id: 5, title: 'database' },
];

const allowedPriorityValues: DropdownItem[] = [
  { id: 1, title: '1 - Critical' },
  { id: 2, title: '2 - High' },
  { id: 3, title: '3 - Moderate' },
  { id: 4, title: '4 - Low' },
  { id: 5, title: '5 - Planning' },
];

const allowedUrgencyValues: DropdownItem[] = [
  { id: 1, title: '1 - High' },
  { id: 2, title: '2 - Medium' },
  { id: 3, title: '3 - Low' },
];

const allowedImpactValues: DropdownItem[] = [
  { id: 1, title: '1 - High' },
  { id: 2, title: '2 - Medium' },
  { id: 3, title: '3 - Low' },
];

function CreateTicketModal({
  open,
  setOpen,
  meetingId,
  prefilledTitle,
  prefilledDescription,
  prefilledCategory,
  prefilledPriority,
  prefilledUrgency,
  prefilledImpact,
  prefilledWorkNotes,
  viewOnly = false,
  ticketNumber,
  ticketCreatedUpdated,
  onTicketUpdated
}: Props) {
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [workNotes, setWorkNotes] = useState('');
  const [category, setCategory] = useState<DropdownItem | null>(null);
  const [priority, setPriority] = useState<DropdownItem | null>(null);
  const [urgency, setUrgency] = useState<DropdownItem | null>(null);
  const [impact, setImpact] = useState<DropdownItem | null>(null);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [workNotesError, setWorkNotesError] = useState<string | null>(null);
  const {
    summaryData,
    isLoadingDetails,
    isLoadingChat,
  } = usePostcallDetails((open && !viewOnly && !(prefilledTitle && prefilledDescription)) ? meetingId : null);

  // Get user details and ticket actions from CopilotStore
  const userDetails = useCopilotStore((state) => state.userDetails);
  const isUserLoading = useCopilotStore((state) => state.isUserLoading);
  const createTicketFromStore = useCopilotStore((state) => state.createTicket);
  const updateTicketFromStore = useCopilotStore((state) => state.updateTicket);

  // View-only conditional rendering flags
  const showShortPrefilled = !!prefilledTitle;
  const showWorkNotesPrefilled = !!prefilledWorkNotes;
  const showCategoryPrefilled = !!prefilledCategory;
  const showPriorityPrefilled = !!prefilledPriority;
  const showUrgencyPrefilled = !!prefilledUrgency;
  const showImpactPrefilled = !!prefilledImpact;

  // Check if prefilled category matches any dropdown option
  const categoryMatchesDropdown = prefilledCategory
    ? allowedCategoryValues.some(item => item.title.toLowerCase() === prefilledCategory.toLowerCase())
    : true;


  // Validation functions
  const validateTitle = (title: string): string => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 5) {
      return 'Title must be at least 5 characters long';
    }
    if (trimmedTitle.length > 100) {
      return 'Title must not exceed 100 characters';
    }
    return "";
  };

  const validateDescription = (desc: string): string => {
    const trimmedDesc = desc.trim();
    if (trimmedDesc.length < 5) {
      return 'Description must be at least 5 characters long';
    }
    return "";
  };

  const isFormValid = (): boolean => {
    const titleValidation = validateTitle(shortDescription);
    const descValidation = ticketNumber ? '' : validateDescription(description);
    const workNotesValidation = ticketNumber ? validateDescription(workNotes) : '';
    return !titleValidation && !descValidation && !workNotesValidation;
  };

  const generateShortDescription = async (longDescription: string) => {
    try {
      const response = await fetch('/api/createDescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: longDescription }),
      });
      
      if (!response.ok) {
        setError('Failed to generate description');
        return;
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
          const urgencyItem = allowedUrgencyValues.find(item => item.id.toString() === content.urgency);
          const impactItem = allowedImpactValues.find(item => item.id.toString() === content.impactScore);
          setUrgency(urgencyItem || allowedUrgencyValues[0]);
          setImpact(impactItem || allowedImpactValues[0]);
        }
      }
    } catch (e) {
      setError('Error generating short description');
      setShortDescription('Error generating short description');
      setUrgency(allowedUrgencyValues[0]);
    }
  };

  useEffect(() => {
    if (open) {
      // If prefilled data is provided, use it directly without API call
      if (prefilledTitle && prefilledDescription) {
        setShortDescription(prefilledTitle);
        setDescription(prefilledDescription);
        
        // Set work notes if provided (for update mode)
        if (prefilledWorkNotes) {
          setWorkNotes(prefilledWorkNotes);
        }
        
        // Set category if provided
        if (prefilledCategory) {
          const categoryItem = allowedCategoryValues.find(
            item => item.title.toLowerCase() === prefilledCategory.toLowerCase()
          );
          if (categoryItem) {
            setCategory(categoryItem);
          }
        }
        
        // Set priority if provided
        if (prefilledPriority) {
          const priorityItem = allowedPriorityValues.find(
            item => item.id.toString() === prefilledPriority
          );
          if (priorityItem) {
            setPriority(priorityItem);
          }
        }
        
        // Set urgency if provided
        if (prefilledUrgency) {
          const urgencyItem = allowedUrgencyValues.find(
            item => item.id.toString() === prefilledUrgency
          );
          if (urgencyItem) {
            setUrgency(urgencyItem);
          }
        }
        
        // Set impact if provided
        if (prefilledImpact) {
          const impactItem = allowedImpactValues.find(
            item => item.id.toString() === prefilledImpact
          );
          if (impactItem) {
            setImpact(impactItem);
          }
        }
      } 
      // Otherwise, use summaryData and make API call
      else if (summaryData) {
        setDescription(summaryData);
        generateShortDescription(summaryData);
      }
    }
  }, [open, summaryData, prefilledTitle, prefilledDescription, prefilledCategory, prefilledPriority, prefilledUrgency, prefilledImpact, prefilledWorkNotes]);

  useEffect(() => {
    if (!open) {
      // Clear form when modal closes
      setShortDescription('');
      setDescription('');
      setWorkNotes('');
      setCategory(null);
      setPriority(null);
      setUrgency(null);
      setImpact(null);
      setError(null);
      setTitleError(null);
      setDescriptionError(null);
      setWorkNotesError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleShortDescriptionChange = (value: string) => {
    setShortDescription(value);
    
    // Validate title and set error
    const validationError = validateTitle(value);
    setTitleError(validationError);
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    
    // Validate description and set error
    const validationError = validateDescription(value);
    setDescriptionError(validationError);
  };

  const handleWorkNotesChange = (value: string) => {
    setWorkNotes(value);
    
    // Validate work notes and set error
    const validationError = validateDescription(value);
    setWorkNotesError(validationError);
  };

  const handleCategoryChange = (item: DropdownItem) => {
    setCategory(item);
  };

  const handlePriorityChange = (item: DropdownItem) => {
    setPriority(item);
  };

  const handleUrgencyChange = (item: DropdownItem) => {
    setUrgency(item);
  };

  const handleImpactChange = (item: DropdownItem) => {
    setImpact(item);
  };

  const handleSubmit = async () => {
    // Validate form before submitting
    if (!isFormValid()) {
      setSuccessMessage(null);
      setError('Please fix the validation errors before submitting');
      return;
    }

    // Validate at least one user identifier is available
    if (!userDetails?.mobilePhone && !userDetails?.employeeId) {
      setSuccessMessage(null);
      setError('Either user phone number or user sys id is required. Cannot create ticket.');
      return;
    }

    const isUpdating = !!ticketNumber;
    setCreatingTicket(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      let result;
      
      if (isUpdating) {
        // Update existing ticket - description is not editable, just pass existing value
        result = await updateTicketFromStore({
          ticketNumber: ticketNumber,
          phoneNumber: userDetails.mobilePhone,
          shortDescription: shortDescription.trim(),
          description: description.trim() || shortDescription.trim(),
          urgency: urgency?.id,
          impact: impact?.id,
          workNotes: workNotes.trim(),
        });
      } else {
        // Create new ticket
        result = await createTicketFromStore({
          phoneNumber: userDetails.mobilePhone,
          shortDescription: shortDescription.trim(),
          description: description.trim(),
          category: category?.title || 'inquiry',
          priority: priority?.id || 1,
          urgency: urgency?.id || 1,
          impact: impact?.id || 1,
          assignmentGroup: 'Service Desk',
        });
      }

      if (result.success) {
        ticketCreatedUpdated?.(true);
        
        if (isUpdating) {
          // For updates: show success message and close after 2 seconds
          setSuccessMessage('Ticket updated successfully!');
          setTimeout(() => {
            onTicketUpdated?.();
            setOpen(false);
            setSuccessMessage("");
          }, 2000);
        } else {
          // For creates: show success message and close after 5 seconds
          setSuccessMessage('Ticket created successfully!');
          setTimeout(() => {
            setOpen(false);
            setSuccessMessage("");
          }, 5000);
        }
      } else {
        const errorMessage = result.error || (isUpdating ? 'Failed to update incident' : 'Failed to create incident');
        setError(errorMessage);
        setTimeout(() => {
          setOpen(false);
          setSuccessMessage("");
          setError("");
        }, 5000);
      }
    } catch (e: any) {
      const errorMessage = `Error ${isUpdating ? 'updating' : 'creating'} incident: ${e.message}`;
      setError(errorMessage);
      setTimeout(() => {
        setError("");
      }, 5000);
    } finally {
      setCreatingTicket(false);
    }
  };

  // Skip loading state when in viewOnly mode with prefilled data
  const isLoading = viewOnly ? false : (isLoadingDetails || isLoadingChat || isUserLoading);

  return (
    <Modal
      isOpen={open}
      onRequestClose={() => setOpen(false)}
      className={clsx(
        'relative top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1/2 bg-white dark:bg-navy-700 rounded-2xl shadow-lg',
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
      ) : (
        <Box className="h-full">
          <Flex align="center" justify="between" className='h-12 border-b-1 border-coolGrey-300'>
            <Flex align="center" className='mx-6 gap-1 border-b-2 border-iris-10  h-12'>
              <Text  weight="bold" className='text-sm text-neutral-12'>
                {ticketNumber ? ticketNumber : 'Tickets'}
              </Text>
              {!viewOnly && !ticketNumber && (
                <Flex align="center" justify="center" className='rounded-md w-4 h-4 bg-iris-9 '>
                  <Text  weight="regular" className='text-white text-xs'>1</Text>
                </Flex>
              )}
            </Flex>
          </Flex>
          <div className='px-5 pt-5'>
            <Flex direction="column" gapY="1" py="2" >
              {(!viewOnly || (viewOnly && showShortPrefilled)) && (
                <TextInput
                  id="shortDescription"
                  name="shortDescription"
                  value={shortDescription}
                  disabled={creatingTicket || viewOnly}
                  handleChange={handleShortDescriptionChange}
                  label="Enter a short description"
                  error={!!titleError}
                  rows={1}
                />
              )}
              {!!titleError && !viewOnly && (
                <Text size="1" className="mt-1  text-red-500 " style={{ fontSize: '0.75rem'}}>
                  {titleError}
                </Text>
              )}
            </Flex>

           

            {!viewOnly && !!userDetails?.fullName && (
              <Flex direction="column" gapY="1" py="2">
                <TextInput
                  id="userName"
                  name="userName"
                  value={userDetails?.fullName}
                  disabled
                  label="Enter a Caller Name"
                  rows={1}
                  fontSize="0.875rem"
                />
              </Flex>
            )}
            

            {/* Description field:
                - Hide for update tickets (ticketNumber exists) - they use Work Notes instead
                - Show for new ticket creation (no ticketNumber)
                - Show in view-only mode when prefilled description exists
            */}
            {(!ticketNumber || (viewOnly && prefilledDescription)) && (
              <Flex direction="column" gapY="1" py="2" className='mt-2'>
                <TextInput
                  id="description"
                  name="description"
                  value={description}
                  disabled={creatingTicket || viewOnly}
                  handleChange={handleDescriptionChange}
                  label="Enter a detailed description"
                  rows={10}
                  fontSize="0.875rem"
                  textColor="text-neutral-l1"
                  error={!!descriptionError}
                  maxLength={5000}
                />
                {!!descriptionError && !viewOnly && (
                  <Text size="1" className="mt-1 text-red-500" style={{ fontSize: '0.75rem'}}>
                    {descriptionError}
                  </Text>
                )}
              </Flex>
            )}

            {/* Work Notes - Only for update tickets, always editable */}
            {!!ticketNumber && (
              <Flex direction="column" gapY="1" py="2" className='mt-2'>
                <Text size="3" weight="medium" className="text-gray-700 mb-1">
                  Work Notes
                </Text>
                {(!viewOnly || (viewOnly && showWorkNotesPrefilled)) && (
                  <TextInput
                    id="workNotes"
                    name="workNotes"
                    value={workNotes}
                    disabled={creatingTicket || viewOnly}
                    handleChange={handleWorkNotesChange}
                    label="Work Notes (Internal)"
                    rows={10}
                    fontSize="0.875rem"
                    textColor="text-neutral-l1"
                    error={!!workNotesError}
                    maxLength={5000}
                  />
                )}
                {!!workNotesError && !viewOnly && (
                  <Text size="1" className="mt-1 text-red-500" style={{ fontSize: '0.75rem'}}>
                    {workNotesError}
                  </Text>
                )}
              </Flex>
            )}

          </div>
            <Flex align="center" className="gap-2 flex-wrap mv-4  p-4">
              {(!viewOnly || (viewOnly && showCategoryPrefilled)) && (
                <Flex direction="column" className='gap-1'>
                  {/* Show static text pill if category doesn't match dropdown options */}
                  {viewOnly && prefilledCategory && !categoryMatchesDropdown ? (
                    <Flex
                      align="center"
                      className="gap-2 min-w-fit max-w-40 h-8 rounded-lg border border-gray-400 bg-gray-50 px-3 py-2"
                    >
                      <CategoryIcon width={14} height={14} />
                      <Text className="text-sm text-gray-900 font-medium whitespace-nowrap">
                        {prefilledCategory}
                      </Text>
                    </Flex>
                  ) : (
                    <PillDropDown
                      items={allowedCategoryValues}
                      pillPlaceholder="Select category"
                      placeholder="Search category..."
                      onClick={handleCategoryChange}
                      disable={viewOnly}
                      selectedItems={category ? [category] : []}
                      onSelectionChange={(items) => setCategory(items[0] || null)}
                      image={<CategoryIcon width={14} height={14} />}
                    />
                  )}
                </Flex>
              )}

              {(!viewOnly || (viewOnly && showPriorityPrefilled)) && (
                <Flex direction="column" className='gap-1'>
                  <PillDropDown
                    items={allowedPriorityValues}
                    pillPlaceholder="Select priority"
                    placeholder="Search priority..."
                    onClick={handlePriorityChange}
                    disable={viewOnly}
                    selectedItems={priority ? [priority] : []}
                    onSelectionChange={(items) => setPriority(items[0] || null)}
                    image={<PriorityIcon width={16} height={16} />}
                  />
                </Flex>
              )}

              {(!viewOnly || (viewOnly && showUrgencyPrefilled)) && (
                <Flex direction="column" className='gap-1'>
                  <PillDropDown
                    items={allowedUrgencyValues}
                    pillPlaceholder="Select urgency"
                    placeholder="Search urgency..."
                    onClick={handleUrgencyChange}
                    disable={viewOnly}
                    selectedItems={urgency ? [urgency] : []}
                    onSelectionChange={(items) => setUrgency(items[0] || null)}
                    image={<UrgencyIcon width={16} height={16} />}
                  />
                </Flex>
              )}

              {(!viewOnly || (viewOnly && showImpactPrefilled)) && (
                <Flex direction="column" className='gap-1'>
                  <PillDropDown
                    items={allowedImpactValues}
                    pillPlaceholder="Select impact"
                    placeholder="Search impact..."
                    onClick={handleImpactChange}
                    disable={viewOnly}
                    selectedItems={impact ? [impact] : []}
                    onSelectionChange={(items) => setImpact(items[0] || null)}
                    image={<ImpactIcon width={16} height={16} />}
                  />
                </Flex>
              )}
            </Flex>
          
          {!!successMessage && !viewOnly && (
            <Flex className="px-4 pb-2">
              <Text size="2" className="text-green-600">
                {successMessage}
              </Text>
            </Flex>
          )}
          {!!error && !viewOnly && (
            <Flex className="px-4 pb-2">
              <Text size="2" className="text-red-500">
                {error}
              </Text>
            </Flex>
          )}

          <Flex justify="end" align='center' className="border-t-1 border-coolGrey-300 h-16 px-2">
            {viewOnly ? (
              <Button
                onClick={() => setOpen(false)}
                variant='outline'
                className="py-1 px-2 cursor-pointer rounded-md"
              >
                Close
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                color="iris"
                disabled={isLoading || creatingTicket || !isFormValid()}
                className="py-1 px-2 cursor-pointer rounded-md"
              >
                {creatingTicket 
                  ? (ticketNumber ? 'Updating Ticket...' : 'Creating Ticket...') 
                  : (ticketNumber ? 'Update Ticket' : 'Create Ticket')
                }
              </Button>
            )}
          </Flex>
        </Box>
      )}
    </Modal>
  );
}

export default CreateTicketModal;
