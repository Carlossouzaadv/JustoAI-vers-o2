'use client';

import { useState, useEffect } from 'react';

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user has completed onboarding
    const hasCompletedOnboarding = localStorage.getItem('justoai-onboarding-completed');

    // Simulate checking user preferences or API call
    setTimeout(() => {
      setShowOnboarding(!hasCompletedOnboarding);
      setIsLoading(false);
    }, 500);
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('justoai-onboarding-completed', 'true');
    setShowOnboarding(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem('justoai-onboarding-completed');
    setShowOnboarding(true);
  };

  return {
    showOnboarding,
    isLoading,
    completeOnboarding,
    resetOnboarding
  };
}