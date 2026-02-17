'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { HardwareSetupWizard } from './HardwareSetupWizard';
import { useSettings } from '../settings-provider';

interface HardwareSetupContextType {
  isOnboardingComplete: boolean;
  markOnboardingComplete: () => void;
}

const HardwareSetupContext = createContext<HardwareSetupContextType | undefined>(undefined);

const STORAGE_KEY = 'kasiPOS_hardwareSetupCompleted';

export function HardwareSetupProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    if (!settings.isLoggedIn) {
      setShowOnboarding(false);
      return;
    }

    // Check localStorage for completion status
    const completed = localStorage.getItem(STORAGE_KEY) === 'true';
    setIsOnboardingComplete(completed);

    // Show onboarding if not completed and user is logged in
    if (!completed) {
      setShowOnboarding(true);
    }
  }, [settings.isLoggedIn]);

  const markOnboardingComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsOnboardingComplete(true);
    setShowOnboarding(false);
  };

  const handleSkip = () => {
    markOnboardingComplete();
  };

  const value = {
    isOnboardingComplete,
    markOnboardingComplete,
  };

  return (
    <HardwareSetupContext.Provider value={value}>
      {children}
      {showOnboarding && (
        <HardwareSetupWizard
          onComplete={markOnboardingComplete}
          onSkip={handleSkip}
        />
      )}
    </HardwareSetupContext.Provider>
  );
}

export function useHardwareSetup() {
  const context = useContext(HardwareSetupContext);
  if (context === undefined) {
    throw new Error('useHardwareSetup must be used within a HardwareSetupProvider');
  }
  return context;
}

