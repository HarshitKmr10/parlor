'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Flex, Text, Button, Box,
} from '@radix-ui/themes';
import ErrorScreen from 'components/icons/ErrorScreen';

interface ErrorProps {
  reset: () => void
}

function Error({ reset }: ErrorProps): JSX.Element {
  const router = useRouter();

  const handleRefresh = () => {
    reset();
  };

  const handleGoHome = () => {
    router.push('/');
  };

  return (
    <Flex align="center" justify="center" style={{ height: '100vh' }}>
      <Box>
        <Flex direction="column" align="center">
          <ErrorScreen />
          <Text size="5" weight="bold" mt="4">
            Something went wrong
          </Text>
          <Text size="2" color="gray">
            Unable to load this page
          </Text>
          <Flex gap="3" mt="4">
            <Button variant="solid" onClick={handleRefresh}>
              Refresh
            </Button>
            <Button variant="outline" onClick={handleGoHome}>
              Back to Homepage
            </Button>
          </Flex>
        </Flex>
      </Box>
    </Flex>
  );
}

export default Error;
