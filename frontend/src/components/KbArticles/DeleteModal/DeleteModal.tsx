import React, { useState } from 'react';
import {
  Dialog, Flex, Button, Text, Box,
} from '@radix-ui/themes';
import { useGlobalContext } from 'contexts/store';
import { API_ENDPOINTS } from 'constants/dashboard';
import { serviceDeskInstance } from 'api/common/axiosInstance';
import { toast } from 'react-toastify';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  articleId: string;
  refreshPage: () => void;
}

const DeleteModal = ({ isOpen, onClose, articleId, refreshPage }: DeleteModalProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      await serviceDeskInstance?.delete(`${API_ENDPOINTS.DOCUMENT}/${articleId}`);
      toast.success("Document deleted successfully!");
    } catch (error) {
      toast.error(error?.response?.data?.message);
    } finally {
      if (refreshPage) {
        refreshPage();
      }
      setTimeout(() => {
        setIsLoading(false);
        onClose();
      }, 1000);
    }
  };


  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Content style={{ maxWidth: 400 }}>
        <Dialog.Title>Are you sure you want to delete this document?</Dialog.Title>
        <Flex gap="3" justify="end" className='mt-12'>
          <Button variant="soft" color="gray" onClick={onClose} disabled={isLoading} className="cursor-pointer">
            Cancel
          </Button>
          <Button color='red' onClick={handleSubmit} disabled={isLoading} className="cursor-pointer">
            {isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default DeleteModal;
