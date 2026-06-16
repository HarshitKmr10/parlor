'use client';

import { ReactNode, useEffect, useState } from 'react';
import { initializeTranslations } from '../helper/i18n';

// Shared bootstrap promise prevents duplicate init/fetch calls across remounts.
let translationInitPromise: Promise<void> | null = null;

const getTranslationInitPromise = (): Promise<void> => {
  if (!translationInitPromise) {
    translationInitPromise = initializeTranslations().catch((error) => {
      translationInitPromise = null;
      throw error;
    });
  }
  return translationInitPromise;
};

interface TranslationInitializerProps {
  children: ReactNode;
}

export default function TranslationInitializer({ children }: TranslationInitializerProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getTranslationInitPromise()
      .catch((error) => {
        console.error('Failed to initialize translations:', error);
      })
      .finally(() => {
        if (isMounted) {
          setIsReady(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Hold rendering until translations are ready to avoid showing raw i18n keys.
  if (!isReady) {
    return null;
  }

  return <>{children}</>;
}
