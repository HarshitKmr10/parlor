import React, { useState } from 'react';
import {
  Dialog,
  Flex,
  Button,
  Text,
} from '@radix-ui/themes';
import { parsePdf } from 'utils/pdfParser';

interface UploadKBModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (content: string) => void;
}

function UploadKBModal({ isOpen, onClose, onUploadSuccess }: UploadKBModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const content = await parsePdf(file);
      onUploadSuccess(content);
      onClose(); // Close the modal after successful upload
    } catch (error) {
      console.error('Error parsing PDF:', error);
      setError('Failed to parse the PDF. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Content style={{ maxWidth: 450 }}>
        <Dialog.Title>Upload Document</Dialog.Title>
        <Flex direction="column" gap="3">
          <Text as="label" size="2">
            Select a PDF file:
          </Text>
          <input type="file" onChange={handleFileChange} accept=".pdf" />
          {!!error && <Text color="red">{error}</Text>}
        </Flex>
        <Flex gap="3" mt="4" justify="end">
          <Button variant="soft" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || isLoading}>
            {isLoading ? 'Uploading...' : 'Upload'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default UploadKBModal;
