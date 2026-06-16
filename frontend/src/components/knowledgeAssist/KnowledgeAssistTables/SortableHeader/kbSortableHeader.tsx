import React from 'react';
import { Flex, Text } from '@radix-ui/themes';
import { ChevronDownIcon } from '@radix-ui/react-icons';

interface Props {
  label: string;
  onClick: () => void;
  className?: string;
}

const KbSortableHeader: React.FC<Props> = ({ label, onClick, className = '' }) => (
  <Flex
    align="center"
    justify="between"
    className={`cursor-pointer hover:bg-gray-100 transition-colors ${className}`}
    style={{ width: '100%', borderRadius: '4px' }}
    onClick={onClick}
  >
    {label.length > 0 && <Text size="1" weight="medium">{label}</Text>}
    <ChevronDownIcon />
  </Flex>
);

export default KbSortableHeader;


