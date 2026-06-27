import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import {
  createEmbeddedSubscriptionCheckout,
  createEmbeddedCreditPackCheckout,
  confirmSimulatedCheckout,
  confirmSimulatedCreditPack,
} from '../services/subscriptionClient';
import { CREDIT_PACKS } from '../config/credits';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useToast } from '../components/Toast';

type CheckoutCompleteHandler = () => Promise<void> | void;

interface StartSubscriptionCheckoutOptions {
  onComplete?: CheckoutCompleteHandler;
}

/** A simulated checkout awaiting in-app confirmation (BILLING_SIMULATION only). */
interface SimulatedCheckoutItem {
  kind: 'plan' | 'pack';
  key: string;
  label: string;
  sessionId: string | null;
}

interface SubscriptionCheckoutContextValue {
  startSubscriptionCheckout: (planKey: string, options?: StartSubscriptionCheckoutOptions) => Promise<void>;
  startCreditPackCheckout: (packKey: string, options?: StartSubscriptionCheckoutOptions) => Promise<void>;
}

const SubscriptionCheckoutContext = createContext<SubscriptionCheckoutContextValue | null>(null);

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() || '';
const stripePromise: Promise<Stripe | null> | null = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null;
const CHECKOUT_REFRESH_DELAYS_MS = [0, 1500, 4000, 8000] as const;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const cleanPlanLabel = (planKey: string) => planKey.replace(/^pending_biz_/, '').replace(/^pending_/, '').replaceAll('_', ' ');

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
  const [simulatedItem, setSimulatedItem] = useState<SimulatedCheckoutItem | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [isConfirmingSimulated, setIsConfirmingSimulated] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const openingRef = useRef(false);
  const completeHandlerRef = useRef<CheckoutCompleteHandler | null>(null);

  const closeCheckout = useCallback(() => {
    setClientSecret(null);
    setSimulatedItem(null);
    setCheckoutError(null);
    setIsConfirmingSimulated(false);
    completeHandlerRef.current = null;
  }, []);

  const runCompleteHandler = useCallback(async () => {
    const handler = completeHandlerRef.current;
    closeCheckout();
    if (!handler) {
      addToast('Checkout complete.', 'success');
      return;
    }
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
  }, [addToast, closeCheckout]);

  const beginCheckout = useCallback(
    async (
      kind: 'plan' | 'pack',
      key: string,
      label: string,
      create: (key: string) => Promise<{ mode?: 'hosted' | 'embedded'; clientSecret?: string; simulated?: boolean; id?: string }>,
      options?: StartSubscriptionCheckoutOptions,
    ) => {
      if (isOpening || openingRef.current) return;
      openingRef.current = true;
      setIsOpening(true);
      setCheckoutError(null);
      completeHandlerRef.current = options?.onComplete ?? null;

      try {
        const session = await create(key);
        if (session.mode === 'embedded' && session.clientSecret) {
          if (!stripePromise) {
            throw new Error('Embedded checkout is not configured. Add VITE_STRIPE_PUBLISHABLE_KEY and rebuild the frontend.');
          }
          setClientSecret(session.clientSecret);
          return;
        }

        if (session.mode === 'hosted' && session.simulated) {
          setSimulatedItem({ kind, key, label, sessionId: session.id ?? null });
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

  const startSubscriptionCheckout = useCallback(
    (planKey: string, options?: StartSubscriptionCheckoutOptions) =>
      beginCheckout('plan', planKey, `${cleanPlanLabel(planKey)} plan`, createEmbeddedSubscriptionCheckout, options),
    [beginCheckout],
  );

  const startCreditPackCheckout = useCallback(
    (packKey: string, options?: StartSubscriptionCheckoutOptions) => {
      const pack = CREDIT_PACKS.find((p) => p.key === packKey);
      const label = pack ? `${pack.name} · ${pack.credits.toLocaleString()} credits` : 'credit pack';
      return beginCheckout('pack', packKey, label, createEmbeddedCreditPackCheckout, options);
    },
    [beginCheckout],
  );

  const handleConfirmSimulatedCheckout = useCallback(async () => {
    if (!simulatedItem || isConfirmingSimulated) return;
    setIsConfirmingSimulated(true);
    setCheckoutError(null);
    try {
      if (simulatedItem.kind === 'pack') {
        await confirmSimulatedCreditPack(simulatedItem.key, simulatedItem.sessionId ?? undefined);
      } else {
        await confirmSimulatedCheckout(simulatedItem.key);
      }
      await runCompleteHandler();
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Checkout could not be confirmed.');
      setIsConfirmingSimulated(false);
    }
  }, [isConfirmingSimulated, runCompleteHandler, simulatedItem]);

  const embeddedOptions = useMemo(
    () => ({
      fetchClientSecret: async () => {
        if (!clientSecret) throw new Error('Checkout session is not ready.');
        return clientSecret;
      },
      onComplete: async () => {
        await runCompleteHandler();
      },
    }),
    [clientSecret, runCompleteHandler],
  );

  const dialogOpen = Boolean(clientSecret || simulatedItem);

  return (
    <SubscriptionCheckoutContext.Provider value={{ startSubscriptionCheckout, startCreditPackCheckout }}>
      {children}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeCheckout(); }}>
        <DialogContent maxWidth="md" className="p-0 sm:p-0">
          <DialogHeader className="border-b border-slate-200 px-5 py-4 text-left dark:border-slate-700">
            <DialogTitle className="text-lg">Secure checkout</DialogTitle>
            <DialogDescription className="not-sr-only text-sm text-slate-500 dark:text-slate-400">
              Complete payment in this window. It closes automatically after confirmation.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-[540px] px-2 py-3 sm:px-4">
            {clientSecret && stripePromise ? (
              <EmbeddedCheckoutProvider stripe={stripePromise} options={embeddedOptions}>
                <EmbeddedCheckout className="min-h-[500px]" />
              </EmbeddedCheckoutProvider>
            ) : simulatedItem ? (
              <div className="flex min-h-[500px] items-center justify-center px-3">
                <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Sandbox checkout
                  </div>
                  <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                    Confirm {simulatedItem.label}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {simulatedItem.kind === 'pack'
                      ? 'This test payment adds the credits to your balance inside the app. No card is charged and no full-page checkout opens.'
                      : 'This test payment updates your plan inside the app. No card is charged and no full-page checkout opens.'}
                  </p>
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      <CreditCard className="h-4 w-4 text-blue-600" aria-hidden="true" />
                      Test payment method
                    </div>
                    <p className="mt-2 font-mono text-sm text-slate-600 dark:text-slate-300">4242 4242 4242 4242</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmSimulatedCheckout}
                    disabled={isConfirmingSimulated}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70"
                  >
                    {isConfirmingSimulated && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {isConfirmingSimulated ? 'Confirming…' : 'Confirm test payment'}
                  </button>
                </div>
              </div>
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
