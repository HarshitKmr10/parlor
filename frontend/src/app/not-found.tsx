'use client';

import React from 'react';
import {
  Box, Flex, Text, Button,
} from '@radix-ui/themes';
import NoModule from 'components/icons/NoModule';
import { useRouter } from 'next/navigation';

function NotFound() {
  const router = useRouter();

  const handleBackToHome = () => {
    router.push('/');
  };

  return (
    <Flex align="center" justify="center" style={{ height: '100vh' }}>
      <Box>
        <Flex direction="column" align="center">
          <NoModule />
          <Text size="5" weight="bold" mt="4">
            Something went wrong
          </Text>
          <Text size="2" color="gray">
            No module available please contact your Admin
          </Text>
          <Flex gap="3" mt="4">
            <Button variant="outline" onClick={handleBackToHome}>
              Back to Homepage
            </Button>
          </Flex>
        </Flex>
      </Box>
    </Flex>
  );
}

export default NotFound;
