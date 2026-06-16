import { Flex } from '@radix-ui/themes';

interface IconBoxProps {
  children: React.ReactNode;
  size?: string;
  className?: string;
  bgColor?: string;
}

export const IconBox = ({ children, size = '56px', className, bgColor }: IconBoxProps) => (
        <Flex align="center" justify="center" width={size} height={size} style={{ backgroundColor: bgColor }} className={`rounded-full ${className}`}>
            {children}
        </Flex>
);
