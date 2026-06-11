
import React from 'react';
import { useModalBehavior } from '../../hooks/useModalBehavior';

interface CreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  onNavigateToPricing?: () => void;
  cost: number;
  currentCredits: number;
}

const CreditModal: React.FC<CreditModalProps> = ({ isOpen, onClose, onConfirm, onNavigateToPricing, cost, currentCredits }) => {
  useModalBehavior(onClose, isOpen);

  if (!isOpen) return null;

  const hasEnoughCredits = currentCredits >= cost;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleNavigateToPricing = () => {
    onClose();
    onNavigateToPricing?.();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[90] p-4 animate-fade-in" onClick={handleOverlayClick}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-modal-title"
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm p-6 text-center animate-fade-scale"
        onClick={e => e.stopPropagation()}
      >
        <h3 id="credit-modal-title" className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {hasEnoughCredits ? 'Confirm Action' : 'Insufficient Credits'}
        </h3>
        
        <div className="my-6">
          <p className="text-gray-600 dark:text-gray-300">
            {hasEnoughCredits
              ? `This action will use ${cost} credits. Your remaining balance will be ${currentCredits - cost}.`
              : `This action requires ${cost} credits, but you only have ${currentCredits}.`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-slate-600">
            Cancel
          </button>
          {hasEnoughCredits ? (
            <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700">
              Confirm & Use Credits
            </button>
          ) : (
            <button onClick={handleNavigateToPricing} className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700">
              Buy More Credits
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreditModal;
