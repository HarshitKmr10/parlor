import React from 'react';
import { Flex, Avatar } from '@radix-ui/themes';

interface CustomAvatarProps {
  alt: string;
  src: string | null;
  name: string;
  height?: string;
  width?: string;
  onClick?: () => void;
  extra?: string;
}

const generateFallback = (name: string): string => {
  if (!name || typeof name !== 'string') return '?';
  
  const names = name.trim().split(' ').filter(n => n.length > 0);
  
  if (names.length === 0) return '';
  
  if (names.length === 1) {
    return names[0][0]?.toUpperCase() || '?';
  }
  
  const first = names[0][0]?.toUpperCase() || '';
  const second = names[1][0]?.toUpperCase() || '';
  
  return first + second || '';
};

function CustomAvatar({
  alt,
  src,
  name,
  height = '45px',
  width = '45px',
  onClick,
  extra,
}: CustomAvatarProps) {
  const fallbackText = generateFallback(name);

  return (
    <Flex align="center" gap="2">
      <Avatar
        variant="solid"
        src={src || undefined}
        fallback={fallbackText}
        radius="medium"
        className={extra}
        style={{ width, height }}
        onClick={onClick}
      />
    </Flex>
  );
}

export default CustomAvatar;