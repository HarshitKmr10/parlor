import React, { useState } from 'react';
import {
  Button, Dialog, Flex, Text,
} from '@radix-ui/themes';
import { PlusIcon } from '@radix-ui/react-icons';
import InputField from 'components/fields/InputField';

interface CreateCollectionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateCollection: (newCollection: {
    title: string;
    description: string;
  }) => void;
}

function CreateCollectionDialog({
  isOpen,
  onOpenChange,
  onCreateCollection,
}: CreateCollectionDialogProps) {
  const [newCollection, setNewCollection] = useState({
    title: '',
    description: '',
  });
  const [formErrors, setFormErrors] = useState({ title: '', description: '' });

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setNewCollection((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    let isValid = true;
    const errors = { title: '', description: '' };

    if (!newCollection.title.trim()) {
      errors.title = 'Title is required';
      isValid = false;
    }

    if (!newCollection.description.trim()) {
      errors.description = 'Description is required';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleCreateCollection = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    onCreateCollection(newCollection);
    setNewCollection({ title: '', description: '' });
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>

      <Dialog.Content>
        <Dialog.Title>Create New Collection</Dialog.Title>
        <form onSubmit={handleCreateCollection}>
          <Flex direction="column" gap="2">
            <InputField
              id="title"
              label="Title"
              placeholder="Enter collection title"
              name="title"
              onChange={handleInputChange}
              value={newCollection.title}
            />
            {!!formErrors.title && (
              <Text color="red" size="1">
                {formErrors.title}
              </Text>
            )}
            <InputField
              id="description"
              label="Description"
              placeholder="Enter collection description"
              name="description"
              onChange={handleInputChange}
              value={newCollection.description}
            />
            {!!formErrors.description && (
              <Text color="red" size="1">
                {formErrors.description}
              </Text>
            )}
            <Button type="submit" style={{ width: '100%' }} size="3" mt="4">
              Create Collection
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default CreateCollectionDialog;
