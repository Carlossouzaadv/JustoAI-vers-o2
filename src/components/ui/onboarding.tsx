'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ICONS } from '../../../lib/icons';

export interface OnboardingStep {
  id: string;
  title: string;
  content: string;
  target: string; // CSS selector or data attribute
  placement?: 'top' | 'bottom' | 'left' | 'right';
  showSkip?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface OnboardingProps {
  steps: OnboardingStep[];
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
  startStep?: number;
}

export function Onboarding({
  steps,
  isActive,
  onComplete,
  onSkip,
  startStep = 0
}: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(startStep);
  const [targetPosition, setTargetPosition] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const getCurrentStep = useCallback(() => steps[currentStep], [currentStep, steps]);
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // Calculate target element position
  const updateTargetPosition = useCallback(() => {
    if (!isActive || !getCurrentStep()) return;

    const targetElement = document.querySelector(getCurrentStep().target);
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

      setTargetPosition({
        top: rect.top + scrollTop,
        left: rect.left + scrollLeft,
        width: rect.width,
        height: rect.height
      });

      // Scroll target into view
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });
    }
  }, [isActive, getCurrentStep]);

  useEffect(() => {
    if (isActive) {
      updateTargetPosition();
      window.addEventListener('resize', updateTargetPosition);
      window.addEventListener('scroll', updateTargetPosition);

      return () => {
        window.removeEventListener('resize', updateTargetPosition);
        window.removeEventListener('scroll', updateTargetPosition);
      };
    }
  }, [isActive, updateTargetPosition]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  const getTooltipPosition = () => {
    if (!targetPosition) return { top: '50%', left: '50%' };

    const step = getCurrentStep();
    const placement = step.placement || 'bottom';
    const offset = 20;

    switch (placement) {
      case 'top':
        return {
          top: targetPosition.top - offset,
          left: targetPosition.left + targetPosition.width / 2,
          transform: 'translate(-50%, -100%)'
        };
      case 'bottom':
        return {
          top: targetPosition.top + targetPosition.height + offset,
          left: targetPosition.left + targetPosition.width / 2,
          transform: 'translate(-50%, 0)'
        };
      case 'left':
        return {
          top: targetPosition.top + targetPosition.height / 2,
          left: targetPosition.left - offset,
          transform: 'translate(-100%, -50%)'
        };
      case 'right':
        return {
          top: targetPosition.top + targetPosition.height / 2,
          left: targetPosition.left + targetPosition.width + offset,
          transform: 'translate(0, -50%)'
        };
      default:
        return {
          top: targetPosition.top + targetPosition.height + offset,
          left: targetPosition.left + targetPosition.width / 2,
          transform: 'translate(-50%, 0)'
        };
    }
  };

  if (!isActive || !getCurrentStep()) return null;

  const step = getCurrentStep();
  const tooltipPosition = getTooltipPosition();

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleSkip}
      />

      {/* Target Highlight */}
      <AnimatePresence>
        {targetPosition && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className="fixed z-50 pointer-events-none"
            style={{
              top: targetPosition.top - 8,
              left: targetPosition.left - 8,
              width: targetPosition.width + 16,
              height: targetPosition.height + 16,
            }}
          >
            <div className="w-full h-full border-4 border-accent-500 rounded-lg shadow-lg bg-white/10 backdrop-blur-sm animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.9 }}
        transition={{ duration: 0.3 }}
        className="fixed z-50 w-80"
        style={tooltipPosition}
      >
        <Card className="p-6 shadow-2xl border-2 border-accent-500 bg-white">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <Badge variant="secondary" className="bg-accent-50 text-accent-700 border-accent-200">
              {currentStep + 1} de {steps.length}
            </Badge>
            {step.showSkip !== false && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-neutral-500 hover:text-neutral-700"
              >
                Pular tour
              </Button>
            )}
          </div>

          {/* Content */}
          <div className="mb-6">
            <h3 className="font-display font-bold text-xl text-primary-800 mb-3">
              {step.title}
            </h3>
            <p className="text-neutral-700 leading-relaxed">
              {step.content}
            </p>
          </div>

          {/* Action Button (if provided) */}
          {step.action && (
            <div className="mb-4">
              <Button
                onClick={step.action.onClick}
                className="w-full bg-accent-500 hover:bg-accent-600 text-white"
              >
                {step.action.label}
                <span className="ml-2">{ICONS.ARROW_RIGHT}</span>
              </Button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    index === currentStep
                      ? 'bg-accent-500 w-6'
                      : index < currentStep
                      ? 'bg-accent-300'
                      : 'bg-neutral-300'
                  }`}
                />
              ))}
            </div>

            <div className="flex space-x-2">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  className="border-neutral-300"
                >
                  {ICONS.ARROW_LEFT}
                  Anterior
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                className="bg-accent-500 hover:bg-accent-600 text-white"
              >
                {isLastStep ? 'Finalizar' : 'Próximo'}
                {!isLastStep && <span className="ml-2">{ICONS.ARROW_RIGHT}</span>}
                {isLastStep && <span className="ml-2">{ICONS.CHECK}</span>}
              </Button>
            </div>
          </div>
        </Card>

        {/* Arrow pointing to target */}
        {step.placement && (
          <div
            className={`absolute w-3 h-3 bg-white border-2 border-accent-500 transform rotate-45 ${
              step.placement === 'top'
                ? 'bottom-[-8px] left-1/2 -translate-x-1/2'
                : step.placement === 'bottom'
                ? 'top-[-8px] left-1/2 -translate-x-1/2'
                : step.placement === 'left'
                ? 'right-[-8px] top-1/2 -translate-y-1/2'
                : 'left-[-8px] top-1/2 -translate-y-1/2'
            }`}
          />
        )}
      </motion.div>
    </>
  );
}

// Hook para gerenciar o estado do onboarding
export function useOnboarding(storageKey: string = 'onboarding-completed') {
  const [isCompleted, setIsCompleted] = useState(true);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(storageKey) === 'true';
    setIsCompleted(completed);
    if (!completed) {
      // Delay para garantir que o DOM esteja pronto
      setTimeout(() => setIsActive(true), 1000);
    }
  }, [storageKey]);

  const startOnboarding = () => {
    setIsActive(true);
  };

  const completeOnboarding = () => {
    setIsActive(false);
    setIsCompleted(true);
    localStorage.setItem(storageKey, 'true');
  };

  const skipOnboarding = () => {
    setIsActive(false);
    setIsCompleted(true);
    localStorage.setItem(storageKey, 'true');
  };

  const resetOnboarding = () => {
    setIsCompleted(false);
    localStorage.removeItem(storageKey);
    setTimeout(() => setIsActive(true), 500);
  };

  return {
    isCompleted,
    isActive,
    startOnboarding,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding
  };
}