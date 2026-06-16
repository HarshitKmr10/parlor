import React, { useEffect, useState } from 'react';
import {
  Dialog,
  Flex,
  Text,
  Button,
  Select,
  IconButton,
  Box,
} from '@radix-ui/themes';
import { Cross2Icon, CheckCircledIcon, CrossCircledIcon } from '@radix-ui/react-icons';
import { serviceDeskInstance } from 'api/common/axiosInstance';
import { toast } from 'react-toastify';
import { isValidEmail } from '@/utils/validationUtils';

interface Collection {
  id: string;
  name: string;
}

interface UserEntry {
  input: string;
  normalizedKey: string;
}

interface AssignmentProgress {
  key: string;
  displayName: string;
  status: 'pending' | 'assigning' | 'success' | 'error';
  resolution?: 'existing' | 'provisioned';
}

interface CollectionAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  towerId: string;
  towerCollections: Collection[];
  onAssignmentComplete: () => void;
  onRefreshCollections?: () => void;
}

function CollectionAssignmentModal({
  open,
  onClose,
  towerId,
  towerCollections,
  onAssignmentComplete,
  onRefreshCollections
}: CollectionAssignmentModalProps) {
  const [userEntries, setUserEntries] = useState<UserEntry[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [inputFeedback, setInputFeedback] = useState('');
  const [assignmentProgress, setAssignmentProgress] = useState<AssignmentProgress[]>([]);
  const normalizeIdentity = (value: string) => value.trim().toLowerCase();

  // Refresh collections when modal opens
  useEffect(() => {
    if (open && onRefreshCollections) {
      onRefreshCollections();
    }
  }, [open]); // Only depend on 'open' to avoid infinite loop

  // Parse input into individual user names
  const parseUserNames = (input: string): string[] => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return [];

    const commaOrNewLineEntries = trimmedInput
      .split(/[\n,]+/)
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (commaOrNewLineEntries.length > 0 && /[\n,]/.test(trimmedInput)) {
      return commaOrNewLineEntries;
    }

    const whitespaceEntries = trimmedInput
      .split(/\s+/)
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (whitespaceEntries.length > 1 && whitespaceEntries.every(entry => isValidEmail(entry))) {
      return whitespaceEntries;
    }

    return [trimmedInput.replace(/[,\n]+$/g, '').trim()].filter(name => name.length > 0);
  };

  // Handle input change
  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (inputFeedback) {
      setInputFeedback('');
    }
  };

  // Handle paste event
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const combined = inputValue + pastedText;
    processInput(combined);
  };

  // Handle key down (Enter to process)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        processInput(inputValue);
      }
    }
  };

  // Process input string into user entries. Resolution happens on the backend when assigning.
  const processInput = (value: string) => {
    const names = parseUserNames(value);
    if (names.length === 0) {
      return;
    }

    const normalizedEntries = names
      .map((name) => normalizeIdentity(name))
      .filter((name) => name.length > 0);

    const invalidEntries = normalizedEntries.filter((entry) => !isValidEmail(entry));
    const existingInputs = new Set(userEntries.map((entry) => entry.normalizedKey));
    const validEntries = normalizedEntries.filter((entry) => isValidEmail(entry));
    const newEntries = validEntries
      .map((entry) => ({
        input: entry,
        normalizedKey: entry,
      }))
      .filter((entry) => entry.normalizedKey.length > 0 && !existingInputs.has(entry.normalizedKey));

    const duplicateCount = validEntries.length - newEntries.length;

    if (newEntries.length > 0) {
      if (assignmentProgress.length > 0 && !assigning) {
        setAssignmentProgress([]);
      }
      setUserEntries((prev) => [...prev, ...newEntries]);
    }

    if (invalidEntries.length > 0) {
      setInputValue(invalidEntries.join(', '));
      setInputFeedback(
        invalidEntries.length === 1
          ? `"${invalidEntries[0]}" is not a valid email address.`
          : `${invalidEntries.length} entries are not valid email addresses.`
      );
      return;
    }

    if (newEntries.length === 0 && duplicateCount > 0) {
      setInputValue('');
      setInputFeedback('Those email addresses were already added.');
      return;
    }

    if (duplicateCount > 0) {
      setInputValue('');
      setInputFeedback('Some email addresses were already added.');
      return;
    }

    setInputValue('');
    setInputFeedback('');
  };

  const handleRemoveEntry = (input: string) => {
    if (assignmentProgress.length > 0 && !assigning) {
      setAssignmentProgress([]);
    }
    setUserEntries(prev => prev.filter(e => e.input !== input));
  };

  const handleAssignCollections = async () => {
    if (userEntries.length === 0) {
      toast.error('Please add at least one valid email address');
      return;
    }

    if (selectedCollections.length === 0) {
      toast.error('Please select at least one collection');
      return;
    }

    setAssigning(true);

    // Initialize progress for each user
    const progress: AssignmentProgress[] = userEntries.map((entry) => ({
      key: entry.normalizedKey,
      displayName: entry.input,
      status: 'pending',
    }));
    setAssignmentProgress(progress);

    let allSucceeded = true;

    // Assign each user individually to show progress
    for (let i = 0; i < userEntries.length; i++) {
      const entry = userEntries[i];

      setAssignmentProgress(prev =>
        prev.map((p, idx) => (idx === i ? { ...p, status: 'assigning' } : p))
      );

      try {
        const response = await serviceDeskInstance.post('/service_desk/collections/assign-users', {
          user_inputs: [entry.input],
          collection_ids: selectedCollections,
          tower_id: towerId,
        });

        const wasProvisioned = Boolean(response.data?.data?.emails_provisioned);
        setAssignmentProgress(prev =>
          prev.map((p, idx) => (
            idx === i
              ? { ...p, status: 'success', resolution: wasProvisioned ? 'provisioned' : 'existing' }
              : p
          ))
        );
      } catch (error) {
        console.error(`Error assigning user ${entry.input}:`, error);
        setAssignmentProgress(prev =>
          prev.map((p, idx) => (idx === i ? { ...p, status: 'error' } : p))
        );
        allSucceeded = false;
      }
    }

    if (allSucceeded) {
      toast.success('All users assigned to collections successfully');
    } else {
      toast.warning('Some users could not be assigned. Check the status below.');
    }

    onAssignmentComplete();

    // Auto-close after a brief delay if all succeeded
    if (allSucceeded) {
      setTimeout(() => {
        handleClose();
      }, 1000);
    } else {
      setAssigning(false);
    }
  };

  const handleClose = () => {
    setUserEntries([]);
    setSelectedCollections([]);
    setInputValue('');
    setInputFeedback('');
    setAssigning(false);
    setAssignmentProgress([]);
    onClose();
  };

  const handleCollectionChange = (collectionId: string) => {
    if (assignmentProgress.length > 0 && !assigning) {
      setAssignmentProgress([]);
    }
    setSelectedCollections(prev =>
      prev.includes(collectionId)
        ? prev.filter(id => id !== collectionId)
        : [...prev, collectionId]
    );
  };

  const hasPendingInput = inputValue.trim().length > 0;
  const hasAssignableUsers = userEntries.length > 0;
  const showAssignmentProgress = assignmentProgress.length > 0;
  const canAssign = hasAssignableUsers
    && !hasPendingInput
    && selectedCollections.length > 0
    && !assigning;

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Content className="max-w-lg">
        <Dialog.Title>Collection Assignments</Dialog.Title>
        <Dialog.Description>
          Add one or more users, then assign them to collections in this tower.
        </Dialog.Description>

        <Box className="mt-4">
          {/* Add Users Section */}
          <Text size="3" weight="medium" className="mb-2 block">
            Add Users
          </Text>
          <Text size="1" color="gray" className="mb-2 block">
            Enter work email addresses only. Resolution happens when you assign.
          </Text>
          <Text size="1" color="gray" className="mb-2 block">
            Existing users are reused and missing users can be provisioned by the backend.
          </Text>
          <Text size="1" color="gray" className="mb-2 block">
            Separate multiple email addresses with commas or new lines, then press Enter or click outside to add them.
          </Text>

          <Box className="mb-4">
            <textarea
              placeholder="e.g. jane.smith@company.com, new.user@company.com"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              rows={2}
              disabled={assigning}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--gray-6)',
                fontFamily: 'inherit',
                fontSize: '14px',
                resize: 'vertical',
                outline: 'none',
                backgroundColor: 'var(--color-background)',
                color: 'var(--gray-12)',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--blue-8)';
                e.target.style.boxShadow = '0 0 0 1px var(--blue-8)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--gray-6)';
                e.target.style.boxShadow = 'none';
                if (inputValue.trim()) {
                  processInput(inputValue);
                }
              }}
            />
            {Boolean(inputFeedback) && (
              <Text size="1" color="red" className="mt-2 block">
                {inputFeedback}
              </Text>
            )}
            {hasPendingInput && (
              <Text size="1" color="gray" className="mt-2 block">
                Press Enter or click outside to validate and add the pending email addresses before assigning.
              </Text>
            )}
          </Box>

          {/* User Entries */}
          {userEntries.length > 0 && (
            <Box className="mb-4">
              <Flex gap="2" wrap="wrap">
                {userEntries.map((entry) => (
                  <Flex
                    key={entry.normalizedKey}
                    align="center"
                    gap="2"
                    style={{
                      backgroundColor: 'var(--gray-3)',
                      border: '1px solid var(--gray-6)',
                      borderRadius: '9999px',
                      padding: '2px 10px 2px 10px',
                    }}
                  >
                    <Text size="2" title={entry.input}>{entry.input}</Text>
                    {!assigning && (
                      <IconButton
                        size="1"
                        variant="ghost"
                        onClick={() => handleRemoveEntry(entry.input)}
                      >
                        <Cross2Icon />
                      </IconButton>
                    )}
                  </Flex>
                ))}
              </Flex>
            </Box>
          )}

          {/* Collections Section */}
          <Text size="3" weight="medium" className="mb-3 block">
            Collections
          </Text>

          <Select.Root onValueChange={handleCollectionChange}>
            <Select.Trigger className="w-full mb-3" placeholder="Select collections" />
            <Select.Content>
              {towerCollections.map((collection) => (
                <Select.Item key={collection.id} value={collection.id}>
                  <Flex align="center" gap="2">
                    <input
                      type="checkbox"
                      checked={selectedCollections.includes(collection.id)}
                      onChange={() => {}} // Controlled by Select.Root
                    />
                    <Text>{collection.name}</Text>
                  </Flex>
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>

          {/* Selected Collections Display */}
          {selectedCollections.length > 0 && (
            <Box className="mb-4">
              <Text size="2" color="gray" className="mb-2">
                Selected Collections: {selectedCollections.length}
              </Text>
              <Flex gap="1" wrap="wrap">
                {selectedCollections.map((collectionId) => {
                  const collection = towerCollections.find(c => c.id === collectionId);
                  return (
                    <Box
                      key={collectionId}
                      className="bg-[var(--blue-3)] text-[var(--blue-11)] px-2 py-1 rounded text-xs"
                    >
                      {collection?.name || collectionId}
                    </Box>
                  );
                })}
              </Flex>
            </Box>
          )}

          {/* Assignment Progress */}
          {showAssignmentProgress && (
            <Box className="mb-4 p-3 rounded-md" style={{ border: '1px solid var(--gray-6)' }}>
              <Text size="2" weight="medium" className="mb-2 block">
                Assignment Progress
              </Text>
              {assignmentProgress.map((p) => (
                <Flex key={p.key} align="center" gap="2" className="py-1">
                  {p.status === 'pending' && (
                    <Box style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: 'var(--gray-5)' }} />
                  )}
                  {p.status === 'assigning' && (
                    <Box
                      style={{
                        width: 14,
                        height: 14,
                        border: '2px solid var(--blue-9)',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                  )}
                  {p.status === 'success' && (
                    <CheckCircledIcon style={{ color: 'var(--green-9)', width: 14, height: 14 }} />
                  )}
                  {p.status === 'error' && (
                    <CrossCircledIcon style={{ color: 'var(--red-9)', width: 14, height: 14 }} />
                  )}
                  <Text size="2">{p.displayName}</Text>
                  <Text size="1" color="gray">
                    {p.status === 'assigning'
                      ? 'Resolving...'
                      : p.status === 'success'
                        ? (p.resolution === 'provisioned' ? 'Created + assigned' : 'Assigned')
                        : p.status === 'error'
                          ? 'Failed'
                          : ''}
                  </Text>
                </Flex>
              ))}
            </Box>
          )}
        </Box>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              Cancel
            </Button>
          </Dialog.Close>
          <Button
            onClick={handleAssignCollections}
            disabled={!canAssign}
            title={
              hasPendingInput ? 'Press Enter or click outside to add the pending user first' :
              !hasAssignableUsers ? 'Add at least one valid email address' :
              selectedCollections.length === 0 ? 'Select at least one collection' :
              ''
            }
          >
            {assigning ? 'Assigning...' : 'Assign Collections'}
          </Button>
        </Flex>

        {/* Spinner animation */}
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default CollectionAssignmentModal;
