import React from 'react';

interface DoubleChevronRightIconProps {
  width?: number;
  height?: number;
  className?: string;
  color?: string;
}

const DoubleChevronRightIcon: React.FC<DoubleChevronRightIconProps> = ({ 
  width = 16, 
  height = 16, 
  className = '',
  color = '#014DC5'
}) => {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 16 16" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path 
        d="M3.5734 3.33398L7.4154 7.17598C7.52445 7.28386 7.61102 7.41229 7.6701 7.55384C7.72918 7.6954 7.7596 7.84726 7.7596 8.00065C7.7596 8.15404 7.72918 8.30591 7.6701 8.44746C7.61102 8.58901 7.52445 8.71744 7.4154 8.82532L3.5734 12.6673M8.24007 3.33398L12.0821 7.17598C12.1911 7.28386 12.2777 7.41229 12.3368 7.55384C12.3958 7.6954 12.4263 7.84726 12.4263 8.00065C12.4263 8.15404 12.3958 8.30591 12.3368 8.44746C12.2777 8.58901 12.1911 8.71744 12.0821 8.82532L8.24007 12.6673" 
        stroke={color} 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default DoubleChevronRightIcon;

