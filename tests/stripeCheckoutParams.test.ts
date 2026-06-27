import { describe, expect, it } from 'vitest';
import {
  buildCheckoutSessionParams,
  type CheckoutPlan,
} from '../functions/src/handlers/stripeBilling';

const candidatePlan: CheckoutPlan = {
  plan: 'accelerator',
  audience: 'candidate',
  mode: 'subscription',
  priceEnv: 'STRIPE_PRICE_ACCELERATOR',
};

const businessPlan: CheckoutPlan = {
  plan: 'starter',
  audience: 'business',
  mode: 'subscription',
  priceEnv: 'STRIPE_PRICE_STARTER',
};

describe('buildCheckoutSessionParams', () => {
  it('keeps embedded checkout fully in-app without return redirects', () => {
    const params = buildCheckoutSessionParams({
      uid: 'uid_123',
      plan: candidatePlan,
      price: 'price_accelerator',
      baseUrl: 'https://career-copilot-a3168.web.app',
      email: 'candidate@example.com',
      useEmbeddedCheckout: true,
    }) as Record<string, unknown>;

    expect(params.ui_mode).toBe('embedded_page');
    expect(params.redirect_on_completion).toBe('never');
    expect(params.return_url).toBeUndefined();
    expect(params.success_url).toBeUndefined();
    expect(params.cancel_url).toBeUndefined();
    expect(params.customer_email).toBe('candidate@example.com');
    expect(params.client_reference_id).toBe('uid_123');
  });

  it('keeps hosted checkout redirects only on the hosted path', () => {
    const params = buildCheckoutSessionParams({
      uid: 'emp_123',
      plan: businessPlan,
      price: 'price_starter',
      baseUrl: 'https://career-copilot-a3168.web.app',
      email: null,
      useEmbeddedCheckout: false,
    }) as Record<string, unknown>;

    expect(params.ui_mode).toBe('hosted_page');
    expect(params.redirect_on_completion).toBeUndefined();
    expect(params.return_url).toBeUndefined();
    expect(params.success_url).toBe('https://career-copilot-a3168.web.app/portal?checkout=success');
    expect(params.cancel_url).toBe('https://career-copilot-a3168.web.app/pricing?audience=employer&checkout=cancel');
    expect(params.customer_email).toBeUndefined();
  });
});
