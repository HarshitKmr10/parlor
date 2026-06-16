import { Flex, Text } from '@radix-ui/themes';
import React from 'react';

interface Props {
  header: string;
}

const DocumentHeader = ({ header = '' }: Props) => {
  return (
    <Flex className="items-center px-4 h-14 border-b-1 border-[#E3E6EA]">
      <Text size="4" weight="medium">
        {header}
      </Text>
    </Flex>
  );
};

export default DocumentHeader;
