// components/Shimmer.tsx
import { Box } from '@radix-ui/themes';
import React from 'react';

interface ShimmerProps {
  height?: string;
  width?: string;
  borderRadius?: string;
  className?: string;
}

const Shimmer = ({
  height = '100%',
  width = '100%',
  borderRadius = '0.375rem',
  className = '',
}: ShimmerProps): JSX.Element => {
  return (
    <Box
      style={{ height, width, borderRadius }}
      className={`animate-pulse bg-gray-200 ${className}`}
    />
  );
};

export default Shimmer;
