
'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { AppSettings, User, Store } from '@/types';
import { db } from '@/lib/db';

interface SettingsContextType {
  settings: AppSettings;
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  isPwa: boolean;
  logout: () => void;
  login: (user: User) => Promise<void>;
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
  currentStore: null,
};

function getInitialSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }
  try {
    const item = window.localStorage.getItem('kasi-pos-settings');
    const storedSettings = item ? JSON.parse(item) : {};
    // Only persist currentUser from localStorage on initial load
    const currentUser = storedSettings.currentUser || null;
    
    // We only keep theme and currentUser from localStorage, the rest is reset
    return { 
        ...defaultSettings, 
        theme: storedSettings.theme || 'light', 
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
  
  const setSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const logout = useCallback(() => {
    const theme = settings.theme; // Preserve theme across logout
    // Create a new settings object for logout state
    const newSettings = {
        ...defaultSettings,
        theme, // keep the theme
        isLoggedIn: false,
        currentUser: null,
        currentStore: null,
    };
    try {
        // Persist only the parts we want to keep after logout
        window.localStorage.setItem('kasi-pos-settings', JSON.stringify({ theme }));
    } catch (error) {
        console.error('Error saving settings to localStorage on logout', error);
    }
    setSettings(newSettings); 
    router.push('/login');
  }, [router, settings.theme]);

  // This effect runs on mount to load the store if a user session exists in localStorage
  useEffect(() => {
    const bootstrapStore = async () => {
        if (settings.currentUser && !settings.currentStore) {
            const store = await db.stores.get(settings.currentUser.storeId);
            if (store) {
                setSetting('currentStore', store);
            } else {
                console.error(`Inconsistent state: User ${settings.currentUser.id} exists but their store ${settings.currentUser.storeId} does not.`);
                logout();
            }
        }
    };
    if (isInitialLoad) {
        bootstrapStore();
    }
  }, [isInitialLoad, settings.currentUser, settings.currentStore, setSetting, logout]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(settings.theme);
    try {
      // Persist only theme and currentUser to localStorage
      const { theme, currentUser } = settings;
      window.localStorage.setItem('kasi-pos-settings', JSON.stringify({ theme, currentUser }));
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
    
    // Wait for store to be hydrated if user is logged in
    if (settings.isLoggedIn && !settings.currentStore) {
        return; 
    }

    const isAuthRoute = AUTH_ROUTES.includes(pathname);
    const isSetupRoute = pathname === SETUP_ROUTE;

    if (!settings.isLoggedIn && !isAuthRoute) {
      router.push('/login');
    } else if (settings.isLoggedIn && settings.currentStore) {
      if (!settings.currentStore.isSetupComplete && !isSetupRoute) {
        router.push(SETUP_ROUTE);
      } else if (settings.currentStore.isSetupComplete) {
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
  }, [settings.isLoggedIn, settings.currentStore, settings.currentUser, pathname, router, isInitialLoad]);


  const login = useCallback(async (user: User) => {
    const store = await db.stores.get(user.storeId);
    if (store) {
        setSettings((prev) => ({ 
            ...prev,
            currentUser: user,
            currentStore: store,
            isLoggedIn: true,
        }));
    } else {
        console.error(`Could not find store with ID ${user.storeId} for user ${user.name}`);
        logout();
    }
  }, [logout]);


  const canRenderChildren = () => {
    if (isInitialLoad) return false;
    if (!settings.isLoggedIn) return AUTH_ROUTES.includes(pathname);
    if (!settings.currentStore) return false; // Wait until store is loaded
    if (!settings.currentStore.isSetupComplete) return pathname === SETUP_ROUTE;
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
