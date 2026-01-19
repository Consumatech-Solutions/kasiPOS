
'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { AppSettings, User } from '@/types';

interface SettingsContextType {
  settings: AppSettings;
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  isPwa: boolean;
  logout: () => void;
  login: (user: User) => void;
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
    const currentUser = storedSettings.currentUser || null;

    return { 
        ...defaultSettings, 
        ...storedSettings, 
        currentUser,
        isLoggedIn: !!currentUser
    };
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
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(settings.theme);
    try {
      window.localStorage.setItem('kasi-pos-settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings to localStorage', error);
    }
  }, [settings]);

  useEffect(() => {
     if (typeof window !== 'undefined') {
        const inPwa = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
        setIsPwa(inPwa);
    }
    setIsInitialLoad(false);
  }, []);

   useEffect(() => {
    if (isInitialLoad) return;

    const isAuthRoute = AUTH_ROUTES.includes(pathname);
    const isSetupRoute = pathname === SETUP_ROUTE;

    if (!settings.isLoggedIn && !isAuthRoute) {
      router.push('/login');
    } else if (settings.isLoggedIn) {
      if (!settings.isStoreSetupComplete && !isSetupRoute) {
        router.push(SETUP_ROUTE);
      } else if (settings.isStoreSetupComplete) {
         if (isAuthRoute || isSetupRoute) {
          router.push('/');
          return;
        }

        // Role-based route protection for staff
        if (settings.currentUser?.role === 'staff' && pathname.startsWith('/settings')) {
          router.push('/');
          return;
        }
      }
    }
  }, [settings.isLoggedIn, settings.isStoreSetupComplete, settings.currentUser, pathname, router, isInitialLoad]);

  const setSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const login = useCallback((user: User) => {
    setSettings((prev) => ({ 
        ...prev,
        currentUser: user,
        isLoggedIn: true,
    }));
  }, []);

  const logout = useCallback(() => {
    const currentSettings = settings;
    const newSettings = {
      ...defaultSettings,
      theme: currentSettings.theme,
      isStoreSetupComplete: currentSettings.isStoreSetupComplete,
      storeProfile: currentSettings.storeProfile,
      isLoggedIn: false, 
      currentUser: null,
    };
    setSettings(newSettings); 
    router.push('/login');
  }, [router, settings]);


  const canRenderChildren = () => {
    if (isInitialLoad) return false;
    if (!settings.isLoggedIn) return AUTH_ROUTES.includes(pathname);
    if (!settings.isStoreSetupComplete) return pathname === SETUP_ROUTE;
    return !AUTH_ROUTES.includes(pathname) && pathname !== SETUP_ROUTE;
  };


  const value = { settings, setSetting, isPwa, logout, login };

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
