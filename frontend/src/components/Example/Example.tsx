import { Flex, Text } from '@radix-ui/themes';
import { MouseEvent } from 'react';
import { ArrowRight } from 'lucide-react';

interface Props {
  text: string;
  value: string;
  onClick: (value: string) => void;
}

export function Example({ text, value, onClick }: Props) {
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    onClick(value);
  };

  return (
    <Flex
      onClick={handleClick}
      justify={{ initial: 'between', md: 'center' }}
      align="center"
      p={{ initial: '3', md: '4' }}
      className={`
        border rounded-md cursor-pointer w-full mt-2
        text-gray-800 hover:bg-gray-50 transition-colors
      `}
    >
      <Text
        size="2"
        align={{ initial: 'left', md: 'center' }}
        className="text-balance"
      >
        {text}
      </Text>

      {/* Show arrow only on mobile */}
      <ArrowRight className="h-4 w-4 shrink-0 text-gray-500 md:hidden" />
    </Flex>
  );
}