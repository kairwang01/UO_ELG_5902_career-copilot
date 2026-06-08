
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
  onSwitchToSignIn: () => void;
}

export default function BusinessForgotPasswordModal({ isOpen, onOpenChange, onSwitchToSignIn }: Props) {
  const [email, setEmail] = useState('');
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
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error: authError } = await data.auth.resetPassword(email);
    if (authError) {
      setError(authError.message);
    } else {
      setMessage('Password reset link sent — check your email.');
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="sm">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>Enter your email to receive a password reset link</DialogDescription>
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

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Sending…' : 'Send Reset Link'}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-3">
          Remembered your password?{' '}
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
