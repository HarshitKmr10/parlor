import React from 'react';
import { Flex, Tooltip } from '@radix-ui/themes';
import { UserType } from 'types/common';
import { HelpCircle } from 'lucide-react';
import UserDropdown from './UserDropdown';
import Link from 'next/link';

interface NavbarRightSectionProps {
  user: UserType | null;
  handleLogout: () => void;
}

function NavbarRightSection({ user, handleLogout }: NavbarRightSectionProps) {
  return (
    <Flex gap="3" align="center" justify="between" mr="3">
      <Tooltip content="Help">
        <Link href="/help" aria-label="Help">
          <HelpCircle size={18} />
        </Link>
      </Tooltip>
      <UserDropdown user={user} handleLogout={handleLogout} />
    </Flex>
  );
}

export default NavbarRightSection;
