import React from 'react';

interface NoPriorityIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

const NoPriorityIcon: React.FC<NoPriorityIconProps> = ({
  width = 16,
  height = 16,
  color = 'lch(62.6% 1.35 272 / 1)',
  className,
  style,
  ariaLabel = 'No Priority',
}) => {
  return (
    <svg
      aria-label={ariaLabel}
      className={className}
      width={width}
      height={height}
      viewBox="0 0 16 16"
      fill={color}
      role="img"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <rect x="1.5" y="7.25" width="3" height="1.5" rx="0.5" opacity="0.9" />
      <rect x="6.5" y="7.25" width="3" height="1.5" rx="0.5" opacity="0.9" />
      <rect x="11.5" y="7.25" width="3" height="1.5" rx="0.5" opacity="0.9" />
    </svg>
  );
};

export default NoPriorityIcon;


