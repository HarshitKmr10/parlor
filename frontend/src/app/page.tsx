'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGlobalContext } from 'contexts/store';
import { UserType } from 'types/userTypes';
import { Organization } from 'types/common';
import { MODULE_ROUTES, ModuleKey } from 'constants/global';
import { getEnabledModules } from 'utils/getEnabledModules';

// Redirect to a module based on its key or to the default route
function redirectToModule(
  moduleKey: ModuleKey,
  router: ReturnType<typeof useRouter>,
): void {
  const route = MODULE_ROUTES[moduleKey] || MODULE_ROUTES.default;
  router.replace(route);
}

// Handle organization routing based on enabled modules
function handleOrganizationRouting(
  organization: Organization | null,
  router: ReturnType<typeof useRouter>,
): void {
  if (!organization) return;

  try {
    const config = JSON.parse(organization.config);
    const enabledModules = getEnabledModules(config.Modules);

    if (enabledModules.length > 0) {
      redirectToModule('home', router);
    } else {
      router.replace(MODULE_ROUTES.default);
    }
  } catch (error) {
    console.error(`Error parsing organization config: ${error}`);
  }
}

// Handle user authentication and redirect to login if necessary
function handleUserAuthentication(
  user: UserType | null,
  router: ReturnType<typeof useRouter>,
): void {
  if (!user || !localStorage.getItem('ACCESS_TOKEN')) {
    router.push('/login');
  }
}

// Home component that handles user authentication and module routing
export default function Home(): null {
  const router = useRouter();
  const { organization, user } = useGlobalContext();

  useEffect(() => {
    handleUserAuthentication(user, router);
    handleOrganizationRouting(organization, router);
  }, [user, organization, router]);

  return null;
}
