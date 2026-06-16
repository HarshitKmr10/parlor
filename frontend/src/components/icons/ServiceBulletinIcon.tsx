import React from 'react';

interface ServiceBulletinIconProps {
  className?: string;
}

const ServiceBulletinIcon: React.FC<ServiceBulletinIconProps> = ({ className = "text-inherit h-5 w-5 font-extrabold" }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
      <path d="M7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z" fill="currentColor" opacity="0.3"/>
      <path d="M9 9h6v1H9V9zm0 4h6v1H9v-1zm0 4h4v1H9v-1z" fill="currentColor" opacity="0.5"/>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" opacity="0.2"/>
      <path d="M12 4.5l2.5 5.07L20 9.5l-4 3.9 1 5.8L12 16.5l-5 3.7 1-5.8L4 9.5l5.5-.93L12 4.5z" fill="currentColor" opacity="0.4"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    </svg>
  );
};

export default ServiceBulletinIcon;
