'use client';

import React from 'react';
import { Box, Flex, Text, Button, Dialog } from '@radix-ui/themes';
import { Mic, AlertCircle } from 'lucide-react';

interface MicrophoneAccessProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
}

export function MicrophoneAccess({ open, onOpenChange, onRetry }: MicrophoneAccessProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 500 }}>
        <Dialog.Title>
          <Flex align="center" gap="2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            Microphone Access Required
          </Flex>
        </Dialog.Title>
        
        <Dialog.Description size="2" className="mt-2">
          Voice features require microphone access to function properly.
        </Dialog.Description>

        <Box className="mt-4 p-4 bg-gray-50 rounded-lg">
          <Text size="2" weight="medium" className="mb-2">
            To enable microphone access:
          </Text>
          <Box className="space-y-1 text-sm text-gray-600">
            <ol className="list-decimal list-inside space-y-1">
              <li>Look for the microphone icon in your browser's address bar</li>
              <li>Click on the microphone icon and select "Allow"</li>
              <li>If you don't see the icon, check your browser's site settings</li>
              <li>Refresh the page after granting permission</li>
            </ol>
          </Box>
        </Box>

        <Flex gap="3" mt="4" justify="end">
          <Button onClick={onRetry}>
            <Mic className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default MicrophoneAccess;
