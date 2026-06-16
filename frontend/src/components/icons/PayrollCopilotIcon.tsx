import React from 'react';

interface PayrollCopilotIconProps {
  className?: string;
}

const PayrollCopilotIcon: React.FC<PayrollCopilotIconProps> = ({ className = "text-inherit h-5 w-5 font-extrabold" }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
      <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
      <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
      <path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill="currentColor" opacity="0.3"/>
      <path d="M8 8h8v8H8V8zm2 2v4h4v-4h-4z" fill="currentColor" opacity="0.2"/>
      <path d="M10 10h4v4h-4v-4z" fill="currentColor" opacity="0.4"/>
      <circle cx="12" cy="12" r="1" fill="currentColor"/>
    </svg>
  );
};

export default PayrollCopilotIcon;
