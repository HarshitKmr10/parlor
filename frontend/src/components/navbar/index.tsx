import React from 'react';
import { useRouter } from 'next/navigation';
import { Flex } from '@radix-ui/themes';

import { useGlobalContext } from 'contexts/store';
import ServiceDeskLogo from 'components/icons/ServiceDeskLogo';
import NavbarRightSection from './NavbarRightSection';

function Navbar(props: { handleLogout: () => void }) {
  const { user } = useGlobalContext();

  return (
    <Flex
      align="center"
      justify="between"
      width="100%"
      height="100%"
      top="0"
      left="0"
      style={{ backgroundColor: 'var(--accent-5)' }}
      className="z-10 border-b border-[var(--gray-8)]"
      pl="4"
    >
      <ServiceDeskLogo />
      <NavbarRightSection user={user} handleLogout={props.handleLogout} />
    </Flex>
  );
}

export default Navbar;
