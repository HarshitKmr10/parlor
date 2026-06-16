import React from 'react';
import { Flex } from '@radix-ui/themes';
import SortIcon from '@/components/icons/SortIcon';

interface Props {
  onClick: () => void;
}

const KbScoreHeader: React.FC<Props> = ({ onClick }) => (
  <Flex
    justify="center"
    align="center"
    className='cursor-pointer hover:bg-gray-100'
    onClick={onClick}
  >
    <SortIcon />
  </Flex>
);

export default KbScoreHeader;


