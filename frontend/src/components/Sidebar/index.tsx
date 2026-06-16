/* eslint-disable */
import Links from './components/Links';
import { Flex, Tooltip } from '@radix-ui/themes';
import { IRoute } from 'types/navigation';

import TeamSelector from 'components/teams/TeamSelector';
import { useGlobalContext } from 'contexts/store';
import UserDropdown from 'components/navbar/UserDropdown';
import { HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

function SidebarHorizon(props: {
  routes: IRoute[];
  [x: string]: any;
  showHeader: boolean;
  handleLogout: () => void;
}) {
  const { routes } = props;
  const { user, organization } = useGlobalContext();

  const parsedOrgConfig = useMemo(() => {
    if (!organization?.config) return null;
    try {
      return JSON.parse(organization.config);
    } catch (error) {
      console.error("Error parsing organization config:", error);
      return null;
    }
  }, [organization?.config]);

  const orgName = useMemo(() => {
    return parsedOrgConfig?.Name || parsedOrgConfig?.name;
  }, [parsedOrgConfig]);

  const isPROFILE_DE = useMemo(() => {
    const normalizedEnv = process.env.NEXT_PUBLIC_CLIENT;
    const currentOrgName = orgName;
    const storedOrgName = typeof window !== 'undefined' ? sessionStorage.getItem('orgName') : null;

    return (
      normalizedEnv === 'PROFILE_DE' ||
      currentOrgName === 'PROFILE_DE' ||
      storedOrgName === 'PROFILE_DE' ||
      user?.org_id === '1afcf297-61be-43a8-8bc8-980c807dab7d' ||
      user?.email === 'admin_spanish@futurepath.ai' // TEMP: Spanish user override - remove this line when no longer needed
    );
  }, [orgName, user?.email, user?.org_id]);

  const isPROFILE_C8 = useMemo(() => {
    const normalizedEnv = process.env.NEXT_PUBLIC_CLIENT;
    const currentOrgName = orgName;
    const storedOrgName = typeof window !== 'undefined' ? sessionStorage.getItem('orgName') : null;

    return (
      normalizedEnv === 'PROFILE_C8' ||
      currentOrgName === 'PROFILE_C8' ||
      storedOrgName === 'PROFILE_C8'
    );
  }, [orgName]);

  const gradientTheme = useMemo(() => {
    if (isPROFILE_C8) return 'bg-[#041E42]';
    if (isPROFILE_DE) return 'bg-[#000000]';
    if (user?.email === 'demo_servicedesk@futurepath.dev')
      return 'bg-gradient-to-t from-[#27374c] to-[#1c304b]';
    return 'bg-gradient-to-t from-[#C84AA3] to-[#352BAE]';
  }, [isPROFILE_C8, isPROFILE_DE, user?.email]);

  return (
    <Flex
      direction={'column'}
      width={'100%'}
      height={'100%'}
      className={`
          px-2 py-3 
          ${gradientTheme}
          z-10
        `}
      justify={'between'}
      align={'center'}
    >
      <div className="hidden">
        <TeamSelector />
      </div>
      <Flex direction={'column'} gap={'1'}>
        <Links routes={routes} />
      </Flex>
      {!props.showHeader && (
        <Flex direction="column" gap="3" align="center">
          <Tooltip content="Help">
            <Link href="/help" aria-label="Help">
              <HelpCircle size={18} className="text-white" />
            </Link>
          </Tooltip>
          <UserDropdown user={user} handleLogout={props.handleLogout} />
        </Flex>
      )}
    </Flex>
  );
}

export default SidebarHorizon;
