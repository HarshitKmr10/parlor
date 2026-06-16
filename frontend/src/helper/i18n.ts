import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const DEFAULT_TRANSLATION_PATH = '/translations/en.json';
const SPANISH_TRANSLATION_PATH = '/translations/es.json';
const GD_TRANSLATION_PATH = '/translations/PROFILE_GD.json';

// Tracks the requested translation path currently represented by the in-memory bundle.
// This remains the requested path even when that path falls back to default translations.
let activeTranslationPath: string | null = null;
// Coalesces concurrent translation requests into a single in-flight promise.
let pendingTranslationLoad: Promise<void> | null = null;

// Get user email from localStorage
const getUserEmail = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const storedUser = localStorage?.getItem("user");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      return user?.email || null;
    }
  } catch (error) {
    console.warn('Error reading user from localStorage:', error);
  }
  
  return null;
};

// Get client-specific translation path from environment
const getClientTranslationPath = async (): Promise<string> => {
  // Check if user email matches PROFILE_DE
  const userEmail = getUserEmail();
  if (userEmail === 'admin_spanish@futurepath.ai') {
    return SPANISH_TRANSLATION_PATH;
  }
  
  // Environment variable for client-specific terminology
  const clientName = process.env.NEXT_PUBLIC_CLIENT;
  
  // PROFILE_GD uses dedicated terminology file
  if (clientName === 'PROFILE_GD') {
    return GD_TRANSLATION_PATH;
  }
  
  // Default to English translations if no custom path is provided or file doesn't exist
  return DEFAULT_TRANSLATION_PATH;
};

// Extract client name from path (e.g., 'PROFILE_GD' from '/translations/PROFILE_GD.json')
const getClientName = (path: string): string => {
  const match = path.match(/\/([^/]+)\.json$/);
  return match ? match[1] : 'en';
};

const getFetchOptions = (): RequestInit | undefined => {
  return process.env.NODE_ENV === 'development' ? ({ cache: 'no-store' } as const) : undefined;
};

const fetchTranslationData = async (
  translationPath: string,
): Promise<{ data: Record<string, any>; resolvedPath: string }> => {
  if (typeof window === 'undefined') {
    return { data: {}, resolvedPath: translationPath };
  }

  const fetchOptions = getFetchOptions();
  const baseUrl = window.location.origin;
  const fullUrl = `${baseUrl}${translationPath}`;
  const response = await fetch(fullUrl, fetchOptions);

  if (response.ok) {
    const data = await response.json();
    return { data, resolvedPath: translationPath };
  }

  if (translationPath !== DEFAULT_TRANSLATION_PATH) {
    const fallbackUrl = `${baseUrl}${DEFAULT_TRANSLATION_PATH}`;
    const fallbackResponse = await fetch(fallbackUrl, fetchOptions);
    if (fallbackResponse.ok) {
      const fallbackData = await fallbackResponse.json();
      return { data: fallbackData, resolvedPath: DEFAULT_TRANSLATION_PATH };
    }
  }

  throw new Error(`Failed to load translations from ${fullUrl}`);
};

const loadCurrentTranslations = async (
  options: {
    forceReload?: boolean;
    emitLanguageChanged?: boolean;
  } = {},
): Promise<void> => {
  if (typeof window === 'undefined') return;

  const { forceReload = false, emitLanguageChanged = false } = options;
  const desiredPath = await getClientTranslationPath();

  // Fast-path: same bundle already in memory, no network call needed.
  if (
    !forceReload &&
    activeTranslationPath === desiredPath &&
    i18n.hasResourceBundle('en', 'translation')
  ) {
    return;
  }

  // If another caller is already loading translations, wait for it first.
  if (pendingTranslationLoad) {
    await pendingTranslationLoad;
    if (
      !forceReload &&
      activeTranslationPath === desiredPath &&
      i18n.hasResourceBundle('en', 'translation')
    ) {
      return;
    }
  }

  // Only one network fetch should happen even if multiple components request load.
  pendingTranslationLoad = (async () => {
    const { data } = await fetchTranslationData(desiredPath);
    i18n.addResourceBundle('en', 'translation', data, true, true);
    activeTranslationPath = desiredPath;

    if (emitLanguageChanged) {
      i18n.emit('languageChanged', 'en');
    }
  })();

  try {
    await pendingTranslationLoad;
  } finally {
    pendingTranslationLoad = null;
  }
};

// Custom backend to load client-specific translations
const customBackend = {
  type: 'backend' as const,
  init: () => {},
  read: async (language: string, namespace: string, callback: (err: any, data?: any) => void) => {
    try {
      // Only run on client side
      if (typeof window === 'undefined') {
        // Return empty object for server-side rendering
        callback(null, {});
        return;
      }

      const translationPath = await getClientTranslationPath();
      const { data } = await fetchTranslationData(translationPath);
      activeTranslationPath = translationPath;
      callback(null, data);
    } catch (error) {
      // Provide fallback empty object instead of error to prevent raw keys
      callback(null, {});
    }
  },
};

// Configuration for i18next
const i18nConfig = {
  lng: 'en', // Always use English as base language
  fallbackLng: 'en',
  
  // Default namespace
  defaultNS: 'translation',
  ns: ['translation'],
  
  // Debug mode (disable in production)
  debug: process.env.NODE_ENV === 'development',
  
  // Interpolation options
  interpolation: {
    escapeValue: false, // React already escapes values
  },
  
  // React-specific options
  react: {
    useSuspense: false, // Disable suspense to avoid SSR issues
  },
  
  // Custom backend
  backend: customBackend,
  
  // Resource loading
  load: 'languageOnly' as const,
  
  // Additional options
  cleanCode: true,
  
  // Enable immediate initialization to load translations right away
  initImmediate: true,
  saveMissing: false,
  
  // Add fallback values to prevent showing raw keys
  missingKeyHandler: (lng: string, ns: string, key: string, fallbackValue: string) => {
    return fallbackValue || key;
  },
};

// Initialize i18next
const i18nInitPromise = i18n
  .use(customBackend)
  .use(initReactI18next)
  .init(i18nConfig as any);

// Function to ensure translations are loaded
export const ensureTranslationsLoaded = async (
  options: {
    throwOnError?: boolean;
  } = {},
): Promise<void> => {
  if (typeof window === 'undefined') return;

  const { throwOnError = false } = options;

  try {
    // Wait for i18n to be initialized
    if (!i18n.isInitialized) {
      await i18nInitPromise;
    }

    await loadCurrentTranslations();
  } catch (error) {
    console.error('Error ensuring translations are loaded:', error);
    if (throwOnError) {
      throw error;
    }
  }
};

// Export the configured i18n instance
export default i18n;

// Utility function to get current client name
export const getCurrentClient = async (): Promise<string> => {
  const path = await getClientTranslationPath();
  return getClientName(path);
};

// Utility function to dynamically switch client terminology
export const switchClientTerminology = async (clientPath: string): Promise<void> => {
  try {
    const response = await fetch(clientPath, getFetchOptions());
    if (!response.ok) {
      throw new Error(`Failed to load client terminology from ${clientPath}`);
    }
    
    const data = await response.json();
    
    // Add resource bundle to i18n
    i18n.addResourceBundle('en', 'translation', data, true, true);
    activeTranslationPath = clientPath;
    
  } catch (error) {
    console.error('Error switching client terminology:', error);
  }
};

// Utility function to reload current client terminology
export const reloadClientTerminology = async (): Promise<void> => {
  const currentPath = await getClientTranslationPath();
  await switchClientTerminology(currentPath);
};

// Initialize translations on app startup
export const initializeTranslations = async (): Promise<void> => {
  if (typeof window === 'undefined') return;

  try {
    // Ensure i18n is initialized
    if (!i18n.isInitialized) {
      await i18nInitPromise;
    }

    // Load translations
    await ensureTranslationsLoaded({ throwOnError: true });
  } catch (error) {
    console.error('Error initializing translations:', error);
    throw error;
  }
};

// Function to reload translations after login/user change
export const reloadTranslationsForUser = async (): Promise<void> => {
  if (typeof window === 'undefined') return;

  try {
    if (!i18n.isInitialized) {
      await i18nInitPromise;
    }

    await loadCurrentTranslations({ emitLanguageChanged: true });
  } catch (error) {
    console.error('Error reloading translations for user:', error);
  }
};

// Type definitions for better TypeScript support
export interface TranslationKeys {
  dashboard: {
    title: string;
    stats: {
      totalArticles: string;
      lowScoring: string;
      needsTranslation: string;
      outdated: string;
    };
    actions: {
      upload: string;
      viewLogs: string;
      viewInventory: string;
      back: string;
      submitForApproval: string;
      createKB: string;
      mergeKB: string;
      refactorAndSave: string;
      translateAndSave: string;
      cancel: string;
    };
    recommendations: {
      title: string;
      noRecommendations: string;
      loading: string;
    };
    commonIssues: {
      title: string;
      noIssues: string;
      loading: string;
    };
    lowScoringArticles: {
      title: string;
      noArticles: string;
      loading: string;
    };
    kbQuality: {
      title: string;
      score: string;
      loading: string;
    };
  };
  upload: {
    title: string;
    dragDrop: string;
    supportedFormats: string;
    maxSize: string;
    uploading: string;
    success: string;
    error: string;
    selectFiles: string;
    cancel: string;
    upload: string;
  };
  common: {
    loading: string;
    error: string;
    success: string;
    retry: string;
    close: string;
    save: string;
    delete: string;
    edit: string;
    view: string;
    search: string;
    filter: string;
    sort: string;
    noData: string;
    confirm: string;
    yes: string;
    no: string;
  };
  errors: {
    loadFailed: string;
    uploadFailed: string;
    saveFailed: string;
    deleteFailed: string;
    networkError: string;
    serverError: string;
    unauthorized: string;
    notFound: string;
    validationError: string;
  };
}
