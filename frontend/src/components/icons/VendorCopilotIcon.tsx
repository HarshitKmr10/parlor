import React from 'react';

interface VendorCopilotIconProps {
  className?: string;
}

const VendorCopilotIcon: React.FC<VendorCopilotIconProps> = ({ className = "text-inherit h-5 w-5 font-extrabold" }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      {/* Building/Store icon representing vendor */}
      <path d="M12 3L2 9v2h2v9h16v-9h2V9L12 3zm0 2.5l7 4.66V19h-3v-6H8v6H5v-8.84l7-4.66z" opacity="0.3"/>
      <path d="M21 9.02V11H19V20H17V11H15V9.02L12 6.02L9 9.02V11H7V20H5V11H3V9.02L12 3.02L21 9.02ZM12 5.5L17 9V11H15V18H13V11H11V18H9V11H7V9L12 5.5Z"/>
      {/* Add copilot indicator - AI brain waves */}
      <path d="M8 14h8M8 16h6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
      <circle cx="10" cy="14" r="1" fill="currentColor"/>
      <circle cx="14" cy="14" r="1" fill="currentColor"/>
      <circle cx="11" cy="16" r="0.8" fill="currentColor"/>
    </svg>
  );
};

export default VendorCopilotIcon;

