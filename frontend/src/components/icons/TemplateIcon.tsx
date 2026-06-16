import React from 'react';

interface TemplateIconProps {
  width?: number;
  height?: number;
  className?: string;
}

const TemplateIcon: React.FC<TemplateIconProps> = ({
  width = 44,
  height = 44,
  className = '',
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g clipPath="url(#clip0_14084_68788)">
        <path
          d="M0 6.6C0 2.95492 2.95492 0 6.6 0H37.4C41.0451 0 44 2.95492 44 6.6V37.4C44 41.0451 41.0451 44 37.4 44H6.6C2.95492 44 0 41.0451 0 37.4V6.6Z"
          fill="#F7F7F8"
        />
        <rect width="44" height="44" rx="6.6" fill="#F7F7F8" />
        <rect x="3.66675" y="6.59961" width="37.4" height="37.4" fill="white" />
        <circle cx="7.70003" cy="11.3665" r="1.83333" fill="#D9D9D9" />
        <rect x="11.7334" y="9.5332" width="26.4" height="1.46667" fill="#D9D9D9" />
        <rect x="11.7334" y="11.7324" width="26.4" height="1.46667" fill="#D9D9D9" />
        <rect x="5.8667" y="16.1328" width="26.4" height="1.46667" fill="#D9D9D9" />
        <rect x="5.8667" y="25.666" width="26.4" height="1.46667" fill="#D9D9D9" />
        <rect x="5.8667" y="36.666" width="26.4" height="1.46667" fill="#D9D9D9" />
        <rect x="5.8667" y="19.0664" width="32.2667" height="5.13333" fill="#D9D9D9" />
        <rect x="5.8667" y="28.5996" width="32.2667" height="5.13333" fill="#D9D9D9" />
        <rect x="5.8667" y="39.5996" width="32.2667" height="5.13333" fill="#D9D9D9" />
      </g>
      <defs>
        <clipPath id="clip0_14084_68788">
          <path
            d="M0 6.6C0 2.95492 2.95492 0 6.6 0H37.4C41.0451 0 44 2.95492 44 6.6V37.4C44 41.0451 41.0451 44 37.4 44H6.6C2.95492 44 0 41.0451 0 37.4V6.6Z"
            fill="white"
          />
        </clipPath>
      </defs>
    </svg>
  );
};

export default TemplateIcon;

