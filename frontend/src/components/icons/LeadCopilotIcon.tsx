import React from 'react';

interface LeadCopilotIconProps {
  className?: string;
}

const LeadCopilotIcon: React.FC<LeadCopilotIconProps> = ({ className = "text-inherit h-5 w-5 font-extrabold" }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      {/* Target/Lead generation icon */}
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7"/>
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
      {/* Arrow pointing to center (lead funnel) */}
      <path d="M12 2L12 6M12 18L12 22M2 12L6 12M18 12L22 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      {/* AI indicator dots */}
      <circle cx="12" cy="8" r="0.8" fill="currentColor" opacity="0.8"/>
      <circle cx="16" cy="12" r="0.8" fill="currentColor" opacity="0.8"/>
      <circle cx="8" cy="12" r="0.8" fill="currentColor" opacity="0.8"/>
    </svg>
  );
};

export default LeadCopilotIcon;

