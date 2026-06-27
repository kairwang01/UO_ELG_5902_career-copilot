import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Loader2 } from 'lucide-react';
import {
  createEmbeddedSubscriptionCheckout,
} from '../services/subscriptionClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useToast } from '../components/Toast';

type CheckoutCompleteHandler = () => Promise<void> | void;

interface StartSubscriptionCheckoutOptions {
  onComplete?: CheckoutCompleteHandler;
}

interface SubscriptionCheckoutContextValue {
  startSubscriptionCheckout: (planKey: string, options?: StartSubscriptionCheckoutOptions) => Promise<void>;
}

const SubscriptionCheckoutContext = createContext<SubscriptionCheckoutContextValue | null>(null);

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() || '';
const stripePromise: Promise<Stripe | null> | null = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null;
const CHECKOUT_REFRESH_DELAYS_MS = [0, 1500, 4000, 8000] as const;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const useSubscriptionCheckout = (): SubscriptionCheckoutContextValue => {
  const ctx = useContext(SubscriptionCheckoutContext);
  if (!ctx) {
    throw new Error('useSubscriptionCheckout must be used within SubscriptionCheckoutProvider');
  }
  return ctx;
};

export const SubscriptionCheckoutProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { addToast } = useToast();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const openingRef = useRef(false);
  const completeHandlerRef = useRef<CheckoutCompleteHandler | null>(null);

  const closeCheckout = useCallback(() => {
    setClientSecret(null);
    setCheckoutError(null);
    completeHandlerRef.current = null;
  }, []);

  const startSubscriptionCheckout = useCallback(
    async (planKey: string, options?: StartSubscriptionCheckoutOptions) => {
      if (isOpening || openingRef.current) return;
      openingRef.current = true;
      setIsOpening(true);
      setCheckoutError(null);
      completeHandlerRef.current = options?.onComplete ?? null;

      try {
        if (!stripePromise) {
          throw new Error('Embedded checkout is not configured. Add VITE_STRIPE_PUBLISHABLE_KEY and rebuild the frontend.');
        }

        const embedded = await createEmbeddedSubscriptionCheckout(planKey);
        if (embedded.mode === 'embedded' && embedded.clientSecret) {
          setClientSecret(embedded.clientSecret);
          return;
        }

        throw new Error('Embedded checkout is unavailable. Please try again after billing configuration is deployed.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Checkout could not be started.';
        setCheckoutError(message);
        addToast(message, 'error');
        completeHandlerRef.current = null;
      } finally {
        openingRef.current = false;
        setIsOpening(false);
      }
    },
    [addToast, isOpening],
  );

  const embeddedOptions = useMemo(
    () => ({
      fetchClientSecret: async () => {
        if (!clientSecret) throw new Error('Checkout session is not ready.');
        return clientSecret;
      },
      onComplete: async () => {
        const handler = completeHandlerRef.current;
        closeCheckout();
        if (handler) {
          addToast('Payment received. Updating your plan…', 'info');
          try {
            for (const delay of CHECKOUT_REFRESH_DELAYS_MS) {
              if (delay > 0) await wait(delay);
              await handler();
            }
            addToast('Checkout complete. Your plan will update as soon as Stripe confirms it.', 'success');
          } catch {
            addToast('Payment was submitted. Refresh this page if the plan does not update shortly.', 'info');
          }
        }
      },
    }),
    [addToast, clientSecret, closeCheckout],
  );

  return (
    <SubscriptionCheckoutContext.Provider value={{ startSubscriptionCheckout }}>
      {children}
      <Dialog open={Boolean(clientSecret)} onOpenChange={(open) => { if (!open) closeCheckout(); }}>
        <DialogContent maxWidth="md" className="p-0 sm:p-0">
          <DialogHeader className="border-b border-slate-200 px-5 py-4 text-left dark:border-slate-700">
            <DialogTitle className="text-lg">Secure checkout</DialogTitle>
            <DialogDescription className="not-sr-only text-sm text-slate-500 dark:text-slate-400">
              Complete payment in this window. Your plan updates after Stripe confirms the payment.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-[540px] px-2 py-3 sm:px-4">
            {clientSecret && stripePromise ? (
              <EmbeddedCheckoutProvider stripe={stripePromise} options={embeddedOptions}>
                <EmbeddedCheckout className="min-h-[500px]" />
              </EmbeddedCheckoutProvider>
            ) : (
              <div className="flex min-h-[500px] items-center justify-center text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Loading checkout…
              </div>
            )}
            {checkoutError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {checkoutError}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </SubscriptionCheckoutContext.Provider>
  );
};
