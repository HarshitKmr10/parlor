import { Flex, Spinner } from '@radix-ui/themes';

function LoadingSpinner() {
  return (
    <Flex align="center" justify="center" style={{ height: '100vh' }}>
      <Spinner size="3" />
    </Flex>
  );
}

export default LoadingSpinner;
