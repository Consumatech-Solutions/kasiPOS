
'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { AppSettings, User } from '@/types';

interface SettingsContextType {
  settings: AppSettings;
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  isPwa: boolean;
  logout: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const defaultSettings: AppSettings = {
  theme: 'light',
  language: 'en',
  campaigns: true,
  marketplace: true,
  boph: true,
  isLoggedIn: false,
  currentUser: null,
  hasSetPassword: false,
  isStoreSetupComplete: true,
  storeProfile: {},
};

function getInitialSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }
  try {
    const item = window.localStorage.getItem('kasi-pos-settings');
    const storedSettings = item ? JSON.parse(item) : {};
     // We'll give precedence to the default settings for login/setup status
     // to ensure we can control it from the code for development.
    return { ...defaultSettings, ...storedSettings, ...{isStoreSetupComplete: defaultSettings.isStoreSetupComplete, isLoggedIn: storedSettings.isLoggedIn || defaultSettings.isLoggedIn } };
  } catch (error) {
    console.error('Error reading settings from localStorage', error);
    return defaultSettings;
  }
}

const AUTH_ROUTES = ['/login', '/request-access', '/verify-code', '/set-password'];
const SETUP_ROUTE = '/store-setup';


export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(getInitialSettings);
  const [isPwa, setIsPwa] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Apply theme on initial load and when settings change
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(settings.theme);

    // Save settings to localStorage whenever they change
    try {
      window.localStorage.setItem('kasi-pos-settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings to localStorage', error);
    }
  }, [settings]);

  useEffect(() => {
    // Check if running in PWA mode on initial load
     if (typeof window !== 'undefined') {
        const inPwa = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
        setIsPwa(inPwa);
    }
    setIsInitialLoad(false);
  }, []);

   useEffect(() => {
    if (isInitialLoad) return; // Don't run redirects on the very first render

    const isAuthRoute = AUTH_ROUTES.includes(pathname);
    const isSetupRoute = pathname === SETUP_ROUTE;

    if (!settings.isLoggedIn && !isAuthRoute) {
      router.push('/login');
    } else if (settings.isLoggedIn) {
      if (!settings.isStoreSetupComplete && !isSetupRoute) {
        router.push(SETUP_ROUTE);
      } else if (settings.isStoreSetupComplete && (isAuthRoute || isSetupRoute)) {
        router.push('/');
      }
    }
  }, [settings.isLoggedIn, settings.isStoreSetupComplete, pathname, router, isInitialLoad]);

  const setSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const logout = useCallback(() => {
    // Reset all settings to default, effectively logging out
    const newSettings = {...defaultSettings, theme: settings.theme, isLoggedIn: false, isStoreSetupComplete: false}; // keep theme
    setSettings(newSettings); 
    router.push('/login');
  }, [router, settings.theme]);

  // Render children only if routing rules are met
  const canRenderChildren = () => {
    if (isInitialLoad) return false;
    if (!settings.isLoggedIn) return AUTH_ROUTES.includes(pathname);
    if (!settings.isStoreSetupComplete) return pathname === SETUP_ROUTE;
    return !AUTH_ROUTES.includes(pathname) && pathname !== SETUP_ROUTE;
  };


  const value = { settings, setSetting, isPwa, logout };

  return <SettingsContext.Provider value={value}>
    {canRenderChildren() ? children : null}
  </SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
