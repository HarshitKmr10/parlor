import React from 'react';

interface APAutomationIconProps {
  className?: string;
}

const APAutomationIcon: React.FC<APAutomationIconProps> = ({ className = "text-inherit h-5 w-5 font-extrabold" }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h18v2H3v-2zm0 4h18v2H3v-2zm0 4h18v2H3v-2z"/>
      <path d="M5 5h2v2H5V5zm0 4h2v2H5V9zm0 4h2v2h-2v-2zm0 4h2v2H5v-2z" fill="currentColor" opacity="0.3"/>
      <path d="M9 5h2v2H9V5zm0 4h2v2H9V9zm0 4h2v2H9v-2zm0 4h2v2H9v-2z" fill="currentColor" opacity="0.3"/>
      <path d="M13 5h2v2h-2V5zm0 4h2v2h-2V9zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z" fill="currentColor" opacity="0.3"/>
      <path d="M17 5h2v2h-2V5zm0 4h2v2h-2V9zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z" fill="currentColor" opacity="0.3"/>
      <circle cx="6" cy="6" r="1" fill="currentColor"/>
      <circle cx="10" cy="10" r="1" fill="currentColor"/>
      <circle cx="14" cy="14" r="1" fill="currentColor"/>
      <circle cx="18" cy="18" r="1" fill="currentColor"/>
    </svg>
  );
};

export default APAutomationIcon;
