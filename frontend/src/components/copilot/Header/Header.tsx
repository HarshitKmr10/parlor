import React from 'react';
import { Flex, Text, IconButton } from '@radix-ui/themes';
import { PanelRightClose, PanelRightOpen, ArrowLeft } from 'lucide-react';
import { headerStyles } from './Header.styles';

interface HeaderProps {
  title: string;
  onToggleChat?: () => void;
  isChatOpen?: boolean;
  onBack?: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, onToggleChat, isChatOpen = false, onBack }) => {
  return (
    <Flex
      align="center"
      justify="between"
      className={headerStyles.container}
      px="4"
    >
      <Flex align="center" gap="3">
        {onBack && (
          <IconButton
            variant="ghost"
            onClick={onBack}
            className="cursor-pointer"
            size="3"
          >
            <ArrowLeft size={20} />
          </IconButton>
        )}
        <Text size="5" weight="medium" className={headerStyles.text}>
          {title}
        </Text>
      </Flex>
      
      {onToggleChat && (
        <IconButton
          variant="ghost"
          onClick={onToggleChat}
          className="cursor-pointer"
          size="3"
        >
          {isChatOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
        </IconButton>
      )}
    </Flex>
  );
};

export default Header;
