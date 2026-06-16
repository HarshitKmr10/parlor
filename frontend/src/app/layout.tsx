
'use client';

import React, { ReactNode, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Script from 'next/script';
import { Theme, type ThemeProps } from '@radix-ui/themes';
import { GlobalContextProvider, useGlobalContext } from '../contexts/store';
import TranslationInitializer from '../components/TranslationInitializer';

import '@radix-ui/themes/styles.css';
import 'styles/index.css';
import 'styles/App.css';

type AccentColor = NonNullable<ThemeProps['accentColor']>;

// ─── Determine theme per email ────────────────────────────────────────────
const getAccentColor = (
  email: string | undefined | null,
  isPROFILE_DE: boolean,
  isPROFILE_C8: boolean,
): AccentColor => {
  if (isPROFILE_C8) return 'sky';
  if (isPROFILE_DE) return 'green';
  if (email === 'demo_servicedesk@futurepath.dev') return 'indigo';
  return 'iris';
};

// ─── SSR Safe Wrapper ─────────────────────────────────────────────────────
const NoSSR: React.ComponentType<{ children: ReactNode }> = dynamic(
  () => Promise.resolve(({ children }) => <>{children}</>),
  { ssr: false }
);

// ─── Dynamic Favicon ─────────────────────────────────────────────────────
function DynamicFavicon() {
  useEffect(() => {
    // PROFILE_C8 has its own favicon — don't override it
    if (process.env.NEXT_PUBLIC_CLIENT === 'PROFILE_C8') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    const update = (e: MediaQueryList | MediaQueryListEvent) => {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (link) {
        link.href = e.matches ? '/favicon_dark.ico' : '/favicon_light.ico';
      }
    };

    // Set on mount
    update(mq);

    // Listen for system theme changes
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return null;
}

// ─── LayoutThemeWrapper ───────────────────────────────────────────────────
function LayoutThemeWrapper({ children }: { children: ReactNode }) {
  const { user, organization} = useGlobalContext();
  
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

  // Save orgName to sessionStorage when available
  useEffect(() => {
    if (orgName && typeof window !== 'undefined') {
      const storedOrgName = sessionStorage.getItem('orgName');
      if (storedOrgName !== orgName) {
        sessionStorage.setItem('orgName', orgName);
      }
    }
  }, [orgName]);

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

  const accentColor = useMemo(
    () => getAccentColor(user?.email, isPROFILE_DE, isPROFILE_C8),
    [user?.email, isPROFILE_DE, isPROFILE_C8],
  );

  return (
    <Theme appearance="light" radius="none" accentColor={accentColor}>
      <DynamicFavicon />
      {children}
    </Theme>
  );
}

// ─── Root Layout ─────────────────────────────────────────────────────────
function RootLayout({ children }: { children: ReactNode }) {
  // Get Clarity project ID from environment variable
  const clarityProjectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  const shouldLoadClarity = Boolean(clarityProjectId && clarityProjectId.trim());

  const faviconPath = process.env.NEXT_PUBLIC_CLIENT === 'PROFILE_C8'
    ? '/favicon_profile_c.ico'
    : '/favicon_light.ico';

  return (
    <html lang="en">
      <head>
        <link rel="icon" href={faviconPath} />
      </head>
      {shouldLoadClarity && (
        <Script 
          strategy="afterInteractive" 
          id="clarity-script"
        >
          {`(function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${clarityProjectId}");`}
        </Script>
      )}

      <body className="h-screen">
        <NoSSR>
          {/* Gate the app tree on i18n readiness to prevent first-paint key flicker. */}
          <TranslationInitializer>
            <GlobalContextProvider>
              <LayoutThemeWrapper>{children}</LayoutThemeWrapper>
            </GlobalContextProvider>
          </TranslationInitializer>
        </NoSSR>
      </body>
    </html>
  );
}

export default RootLayout;
