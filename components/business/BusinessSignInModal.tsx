
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

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchToSignUp: () => void;
  onSwitchToForgotPassword: () => void;
}

export default function BusinessSignInModal({
  isOpen,
  onOpenChange,
  onSwitchToSignUp,
  onSwitchToForgotPassword,
}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape closes the modal
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onOpenChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: authError } = await data.auth.signInWithPassword(email, password);
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
    // On success the auth state change in App.tsx closes the modal naturally
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="sm">
        <DialogHeader>
          <DialogTitle>Welcome Back</DialogTitle>
          <DialogDescription>Sign in to your business account</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-md text-sm mt-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>

        <div className="text-center mt-3">
          <button
            type="button"
            onClick={onSwitchToForgotPassword}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Forgot Password?
          </button>
        </div>

        <p className="text-center text-sm text-gray-600 mt-2">
          Don&apos;t have a business account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            Sign Up
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
