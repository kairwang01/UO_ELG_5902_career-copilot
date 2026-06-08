import React, { useState } from 'react';
import type { AppSession as Session } from '../lib/data';
import { ALL_PLANS, BUSINESS_PLANS } from '../config';
import type { UserProfile } from '../types';

interface DevModeModalProps {
  session: Session | null;
  profile: UserProfile | null;
  onClose: () => void;
  onSetPlan: (planKey: string) => Promise<boolean>;
}

const DEV_PASSWORD = 'abi1183';

const DevModeModal: React.FC<DevModeModalProps> = ({ session, profile, onClose, onSetPlan }) => {
  const [stage, setStage] = useState<'password' | 'selection'>('password');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const isEmployer = profile?.role === 'employer';
  const plansToShow = isEmployer ? BUSINESS_PLANS : ALL_PLANS;
  const defaultPlanKey = isEmployer ? 'single_post' : 'free';
  const [selectedPlan, setSelectedPlan] = useState<string>(defaultPlanKey);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === DEV_PASSWORD) {
      setStage('selection');
      setError('');
    } else {
      setError('Incorrect password.');
    }
  };

  const handleSetPlan = async () => {
    if (!session) {
      setError('No active session. Please log in.');
      return;
    }
    setLoading(true);
    setMessage('');
    setError('');
    const success = await onSetPlan(selectedPlan);
    if (success) {
      setMessage(`Plan successfully set to ${plansToShow[selectedPlan as keyof typeof plansToShow].name}. The app will update shortly.`);
      setTimeout(() => {
        onClose();
      }, 2000);
    } else {
      setError('Failed to update the plan in the database.');
    }
    setLoading(false);
  };

  const renderPasswordStage = () => (
    <form onSubmit={handlePasswordSubmit} className="space-y-4">
      <h3 className="text-xl font-bold text-center text-gray-800">Developer Mode</h3>
      <p className="text-sm text-center text-gray-600">Enter the password to access development tools.</p>
      <div>
        <label htmlFor="dev-password" className="sr-only">Password</label>
        <input
          id="dev-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Password"
          autoFocus
        />
      </div>
      {error && <p className="text-red-600 text-sm text-center">{error}</p>}
      <button
        type="submit"
        className="w-full bg-gray-800 text-white py-2.5 rounded-md hover:bg-gray-900 font-semibold"
      >
        Unlock
      </button>
    </form>
  );

  const renderSelectionStage = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-center text-gray-800">Set User Plan</h3>
      <p className="text-sm text-center text-gray-600">Simulate a subscription plan for the current {isEmployer ? 'employer' : 'candidate'} user ({session?.user?.email}).</p>

      <div className="grid grid-cols-2 gap-3">
        {Object.values(plansToShow).map(plan => (
          <button
            key={plan.key}
            onClick={() => setSelectedPlan(plan.key)}
            className={`p-3 border-2 rounded-lg text-left transition-all text-sm
              ${selectedPlan === plan.key
                ? 'border-blue-600 bg-blue-50/80 shadow-sm'
                : 'border-gray-300 bg-white hover:border-blue-400'
              }`
            }
          >
            <span className="font-bold text-gray-900">{plan.name}</span>
            <span className="block text-gray-600">{plan.price}</span>
          </button>
        ))}
      </div>

      {message && <p className="text-green-600 text-sm text-center font-semibold">{message}</p>}
      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      <button
        onClick={handleSetPlan}
        disabled={loading}
        className="w-full bg-blue-700 text-white py-2.5 rounded-md hover:bg-blue-800 disabled:bg-blue-400 font-semibold"
      >
        {loading ? 'Setting Plan...' : `Set Plan to ${plansToShow[selectedPlan as keyof typeof plansToShow].name}`}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4 animate-fade-in" onClick={handleOverlayClick}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-8" onClick={(e) => e.stopPropagation()}>
        {stage === 'password' ? renderPasswordStage() : renderSelectionStage()}
      </div>
    </div>
  );
};

export default DevModeModal;
