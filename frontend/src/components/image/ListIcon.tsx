import React from 'react';
import Image from 'next/image'; // Importing the Next.js Image component
import MonitorIcon from 'components/icons/MonitorIcon';
import NetworkIcon from 'components/icons/NetworkIcon';
import SecurityIcon from 'components/icons/SecurityIcon';
import { FaPhone, FaVideo } from 'react-icons/fa';

type ListIconProps = {
  iconType?: string;
  imageType?: string;
};

// Define default props for optional properties
const defaultProps: Partial<ListIconProps> = {
  iconType: '',
  imageType: 'default', // Assuming 'default' triggers the default icon
};

function ListIcon({ iconType, imageType = 'default' }: ListIconProps) {
  const iconStyles = 'absolute bg-[#4285F4] text-lg p-0.5 top-0 left-0 rounded-full text-white border-white border-2';

  function renderIcon() {
    if (!iconType) return null;
    if (iconType === 'phone') return <FaPhone className={iconStyles} />;
    if (iconType === 'meet') return <FaVideo className={iconStyles} />;
    return null;
  }

  function renderImage() {
    switch (imageType) {
      case 'monitor':
        return <MonitorIcon />;
      case 'network':
        return <NetworkIcon />;
      case 'security':
        return <SecurityIcon />;
      default:
        // Using Next.js Image component for better performance and optimization
        return (
          <Image
            src="/components/icons/BotIcon.png"
            alt="Default Icon"
            width={48}
            height={48}
          />
        );
    }
  }

  return (
    <div className="relative w-12 h-12">
      <div className="bg-[#404395] w-12 h-12 rounded-full flex items-center justify-center">
        {renderImage()}
      </div>
      {renderIcon()}
    </div>
  );
}

ListIcon.defaultProps = defaultProps;

export default ListIcon;
