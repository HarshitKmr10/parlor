import { Flex, Text } from '@radix-ui/themes';
import React from 'react';

const Header = () => {
  return (
    <Flex align='center' className='w-full h-14 p-4 mb-3 border-b-1'>
      <Text size='4' weight='medium'>Tech Ops</Text>
    </Flex>
  );
};

export default Header;

