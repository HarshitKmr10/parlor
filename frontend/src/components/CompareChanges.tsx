import React from 'react';
import {
  Box, Flex, Text, Button,
} from '@radix-ui/themes';
import RichTextEditor from 'components/TipTap/TipTap';

interface CompareChangesProps {
  originalContent: string;
  updatedContent: string;
  onClose: () => void;
}

const CompareChanges: React.FC<CompareChangesProps> = ({ originalContent, updatedContent, onClose }) => (
    <Box className="h-screen flex flex-col p-4">
      <Flex justify="between" align="center" mb="4">
        <Text size="5" weight="bold">Compare Changes</Text>
        <Button onClick={onClose}>Close</Button>
      </Flex>
      <Flex className="flex-grow">
        <Box className="w-1/2 pr-2">
          <Text size="3" weight="bold" mb="2">Original Content</Text>
          <RichTextEditor content={originalContent} onChange={() => {}} />
        </Box>
        <Box className="w-1/2 pl-2">
          <Text size="3" weight="bold" mb="2">Updated Content</Text>
          <RichTextEditor content={updatedContent} onChange={() => {}} />
        </Box>
      </Flex>
    </Box>
);

export default CompareChanges;
