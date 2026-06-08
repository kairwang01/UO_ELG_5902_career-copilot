
import { useState, useCallback } from 'react';
import { useCredits } from '../contexts/CreditsContext';
import { TOOL_CREDIT_COSTS } from '../config/credits';
import type { AppSession as Session } from '../lib/data';

type ToolKey = keyof typeof TOOL_CREDIT_COSTS;

export const useCreditCheck = (toolKey: ToolKey, session: Session | null, navigateToPricing: () => void) => {
  const { credits, deductCredits } = useCredits();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [onConfirmCallback, setOnConfirmCallback] = useState<(() => void) | null>(null);
  
  const cost = TOOL_CREDIT_COSTS[toolKey] || 0;

  const checkAndProceed = useCallback((callback: () => void) => {
    if (session?.user?.email === 'abhishek.ip@gmail.com') {
      // Bypass the modal entirely and just proceed
      deductCredits(cost, session).then(() => callback());
      return;
    }
    setOnConfirmCallback(() => callback);
    setIsModalOpen(true);
  }, [session, cost, deductCredits]);

  const handleConfirm = async () => {
    if (onConfirmCallback) {
      const success = await deductCredits(cost, session);
      if (success) {
        onConfirmCallback();
      } else {
        // This case should ideally not happen if checks are right, but as a fallback:
        alert("An error occurred while deducting credits. Please try again.");
      }
    }
    setIsModalOpen(false);
    setOnConfirmCallback(null);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setOnConfirmCallback(null);
  };

  const modalProps = {
    isOpen: isModalOpen,
    onClose: handleClose,
    onConfirm: handleConfirm,
    onNavigateToPricing: () => {
        handleClose();
        navigateToPricing();
    },
    cost,
    currentCredits: credits,
  };

  return {
    checkAndProceed,
    CreditModalComponent: modalProps,
    toolCost: cost
  };
};
