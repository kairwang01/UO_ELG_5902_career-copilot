
import React, { useState, useEffect } from 'react';
import { data } from '@/lib/data';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Check } from 'lucide-react';

interface PlanOption {
  id: string;
  name: string;
  price: number;
  features: string[];
}

// Mirrors the 4-plan grid shown in the prototype
const plans: PlanOption[] = [
  {
    id: 'free',
    name: 'Free Plan',
    price: 0,
    features: ['3 active job posts', '30-day job listing', 'Basic AI job creation', 'Standard applicant view'],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 79,
    features: ['8 active job posts', '30-day job visibility', 'AI job description generator', 'Basic candidate matching'],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 199,
    features: ['20 active job posts', '45-day job visibility', 'Advanced AI matching', 'Analytics & company branding'],
  },
  {
    id: 'pro',
    name: 'Pro / Enterprise',
    price: 499,
    features: ['100 active job posts', '60-day premium visibility', 'Full AI + verified talent access', 'Priority support & insights'],
  },
];

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchToSignIn: () => void;
  onSignedUp?: () => Promise<void> | void;
}

export default function BusinessSignUpModal({ isOpen, onOpenChange, onSwitchToSignIn, onSignedUp }: Props) {
  const [selectedPlan, setSelectedPlan] = useState('starter');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Escape closes the modal
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onOpenChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);

    const { data: authData, error: authError } = await data.auth.signUp(email, password);

    if (authError) {
      if (authError.message.includes('email-already-in-use') || authError.message.includes('already registered')) {
        setError('An account with this email already exists. Please sign in.');
        onSwitchToSignIn();
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    if (authData) {
      // TODO Phase 2: map selectedPlan to actual Stripe plan keys
      const statusForDb = selectedPlan === 'free' ? 'free' : `pending_biz_${selectedPlan}`;
      const { error: profileError } = await data.profiles.upsert({
        id: authData.id,
        subscription_status: statusForDb,
        full_name: '',
        role: 'employer',
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        setError(`Account created but profile setup failed: ${profileError.message}`);
      } else {
        await onSignedUp?.();
        setMessage('Account created! You are now signed in.');
      }
    }

    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="md">
        <DialogHeader>
          <DialogTitle>Create a Business Account</DialogTitle>
          <DialogDescription>Sign up to post jobs and access hiring tools</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-md text-sm mt-4">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded-md text-sm mt-4">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Plan picker */}
          <div>
            <p className="text-center mb-3 text-gray-700 text-sm">Choose a job posting plan</p>
            <div className="grid grid-cols-2 gap-3">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative text-left p-4 rounded-lg border-2 transition-all duration-150 ${
                    selectedPlan === plan.id
                      ? 'border-blue-600 bg-blue-50/80'
                      : 'border-gray-300 bg-white hover:border-blue-400'
                  }`}
                >
                  <h3 className="text-base text-gray-900 mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-2xl font-semibold text-gray-900">${plan.price}</span>
                    <span className="text-sm text-gray-500">/ month</span>
                  </div>
                  <ul className="space-y-1.5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-500">
                        <Check size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          </div>

          <Input
            type="email"
            placeholder="Business Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password (min. 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <Input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Sign Up to Post Jobs'}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-3">
          Already have a business account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignIn}
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            Sign In
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
