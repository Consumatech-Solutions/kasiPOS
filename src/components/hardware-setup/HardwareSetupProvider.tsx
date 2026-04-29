"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { HardwareSetupWizard } from "./HardwareSetupWizard";
import { useSettings } from "../settings-provider";

interface HardwareSetupContextType {
  isOnboardingComplete: boolean;
  markOnboardingComplete: () => void;
  openHardwareSetup: () => void;
}

const HardwareSetupContext = createContext<
  HardwareSetupContextType | undefined
>(undefined);

const STORAGE_KEY = "kasiPOS_hardwareSetupCompleted";

export function HardwareSetupProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { settings } = useSettings();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  useEffect(() => {
    if (!settings.isLoggedIn) {
      setShowOnboarding(false);
      return;
    }

    const completed = localStorage.getItem(STORAGE_KEY) === "true";
    setIsOnboardingComplete(completed);

    if (!completed) {
      setShowOnboarding(true);
    }
  }, [settings.isLoggedIn]);

  const markOnboardingComplete = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsOnboardingComplete(true);
    setShowOnboarding(false);
  };

  const handleComplete = () => {
    markOnboardingComplete();
    setManualOpen(false);
  };

  const handleSkip = () => {
    markOnboardingComplete();
    setManualOpen(false);
  };

  const openHardwareSetup = () => setManualOpen(true);

  const value = {
    isOnboardingComplete,
    markOnboardingComplete,
    openHardwareSetup,
  };

  const showWizard = showOnboarding || manualOpen;

  return (
    <HardwareSetupContext.Provider value={value}>
      {children}
      {showWizard && (
        <HardwareSetupWizard onComplete={handleComplete} onSkip={handleSkip} />
      )}
    </HardwareSetupContext.Provider>
  );
}

export function useHardwareSetup() {
  const context = useContext(HardwareSetupContext);
  if (context === undefined) {
    throw new Error(
      "useHardwareSetup must be used within a HardwareSetupProvider",
    );
  }
  return context;
}
