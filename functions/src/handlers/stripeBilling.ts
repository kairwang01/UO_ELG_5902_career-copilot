/**
 * Stripe billing integration.
 *
 * This is the real-payment path that completes the entitlement gate introduced in
 * setSubscriptionStatus: only the Stripe webhook writes billing/{uid}.active=true,
 * then the existing plan-selection logic activates role/credits from that server
 * entitlement. Clients never write billing docs directly.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import Stripe from "stripe";
import { requireAuth } from "../middleware/auth";
import { USERS_COLLECTION, USER_FIELDS } from "../credits/schema";
import { applySubscriptionSelection } from "./setSubscriptionStatus";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const BILLING_COLLECTION = "billing";
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

type BillingAudience = "candidate" | "business";
type CheckoutMode = "subscription" | "payment";

interface CheckoutPlan {
  plan: string;
  audience: BillingAudience;
  mode: CheckoutMode;
  priceEnv: string;
}

const CHECKOUT_PLANS: Record<string, Omit<CheckoutPlan, "plan">> = {
  essentials: { audience: "candidate", mode: "subscription", priceEnv: "STRIPE_PRICE_ESSENTIALS" },
  accelerator: { audience: "candidate", mode: "subscription", priceEnv: "STRIPE_PRICE_ACCELERATOR" },
  executive: { audience: "candidate", mode: "subscription", priceEnv: "STRIPE_PRICE_EXECUTIVE" },
  starter: { audience: "business", mode: "subscription", priceEnv: "STRIPE_PRICE_STARTER" },
  growth: { audience: "business", mode: "subscription", priceEnv: "STRIPE_PRICE_GROWTH" },
  pro: { audience: "business", mode: "subscription", priceEnv: "STRIPE_PRICE_PRO" },
  single_post: { audience: "business", mode: "payment", priceEnv: "STRIPE_PRICE_SINGLE_POST" },
  job_pack: { audience: "business", mode: "payment", priceEnv: "STRIPE_PRICE_JOB_PACK" },
};

function secretOrEnv(secret: ReturnType<typeof defineSecret>, envName: string): string | undefined {
  try {
    const value = secret.value();
    if (value) return value;
  } catch {
    // Secret Manager values are unavailable in direct unit tests and some
    // emulator paths; fall back to process.env for local test fixtures.
  }
  return process.env[envName];
}

function getStripeSecretKey(): string | undefined {
  return secretOrEnv(STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY");
}

function getStripeWebhookSecret(): string | undefined {
  return secretOrEnv(STRIPE_WEBHOOK_SECRET, "STRIPE_WEBHOOK_SECRET");
}

function getStripe(): Stripe {
  const key = getStripeSecretKey();
  if (!key) {
    throw new HttpsError("failed-precondition", "Stripe is not configured.");
  }
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

/**
 * Demo/test billing switch. When BILLING_SIMULATION=true, checkout is simulated by an
 * in-app fake-payment page (no Stripe keys / price ids needed) that flows through the
 * SAME entitlement path as the real Stripe webhook. Non-secret flag — enable ONLY in
 * demo/staging; in production it stays off and the real Stripe path is used.
 */
function billingSimulationEnabled(): boolean {
  return process.env.BILLING_SIMULATION === "true";
}

function appBaseUrl(): string {
  const value = process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || process.env.WEB_APP_URL;
  if (!value) {
    throw new HttpsError("failed-precondition", "APP_BASE_URL is not configured.");
  }
  return value.replace(/\/$/, "");
}

export function billingPortalReturnPathForAudience(audience: unknown): string {
  return audience === "business" ? "/portal?billing=return" : "/workspace/billing";
}

function normalizeCheckoutPlan(raw: unknown): CheckoutPlan {
  const key = typeof raw === "string" ? raw.trim().replace(/^pending_biz_/, "").replace(/^pending_/, "") : "";
  const plan = CHECKOUT_PLANS[key];
  if (!key || !plan) {
    throw new HttpsError("invalid-argument", "Unsupported paid plan.");
  }
  return { plan: key, ...plan };
}

function planKeyForSelection(plan: string, audience: BillingAudience): string {
  return audience === "business" ? `pending_biz_${plan}` : `pending_${plan}`;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export interface StripeEntitlementInput {
  uid: string;
  plan: string;
  audience: BillingAudience;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  checkoutSessionId?: string | null;
  checkoutMode?: CheckoutMode | null;
}

function assertEntitlementInput(input: StripeEntitlementInput): CheckoutPlan {
  const expected = CHECKOUT_PLANS[input.plan];
  if (!input.uid || !expected || expected.audience !== input.audience) {
    throw new HttpsError("invalid-argument", "Invalid Stripe entitlement payload.");
  }
  return { plan: input.plan, ...expected };
}

export async function activateStripeEntitlement(input: StripeEntitlementInput) {
  const plan = assertEntitlementInput(input);
  const now = FieldValue.serverTimestamp();
  await db.collection(BILLING_COLLECTION).doc(input.uid).set(
    {
      active: true,
      plan: plan.plan,
      audience: plan.audience,
      mode: input.checkoutMode ?? plan.mode,
      provider: "stripe",
      stripe_customer_id: input.stripeCustomerId ?? null,
      stripe_subscription_id: input.stripeSubscriptionId ?? null,
      checkout_session_id: input.checkoutSessionId ?? null,
      status: "active",
      pending_plan: FieldValue.delete(),
      pending_audience: FieldValue.delete(),
      activated_at: now,
      updated_at: now,
    },
    { merge: true },
  );

  return applySubscriptionSelection(input.uid, planKeyForSelection(plan.plan, plan.audience));
}

export async function deactivateStripeEntitlement(input: {
  uid: string;
  audience: BillingAudience;
  stripeSubscriptionId?: string | null;
  reason?: string;
}) {
  const now = FieldValue.serverTimestamp();
  await db.runTransaction(async (tx) => {
    const billingRef = db.collection(BILLING_COLLECTION).doc(input.uid);
    const userRef = db.collection(USERS_COLLECTION).doc(input.uid);
    tx.set(
      billingRef,
      {
        active: false,
        status: input.reason ?? "inactive",
        stripe_subscription_id: input.stripeSubscriptionId ?? FieldValue.delete(),
        cancelled_at: now,
        updated_at: now,
      },
      { merge: true },
    );
    tx.set(
      userRef,
      {
        [USER_FIELDS.subscriptionStatus]: "free",
        [USER_FIELDS.role]: input.audience === "business" ? "employer" : "candidate",
        [USER_FIELDS.updatedAt]: now,
      },
      { merge: true },
    );
  });
}

async function findBillingBySubscription(stripeSubscriptionId: string): Promise<{
  uid: string;
  audience: BillingAudience;
} | null> {
  const snap = await db
    .collection(BILLING_COLLECTION)
    .where("stripe_subscription_id", "==", stripeSubscriptionId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const audience = doc.get("audience");
  if (audience !== "candidate" && audience !== "business") return null;
  return { uid: doc.id, audience };
}

interface CreateCheckoutRequest {
  planKey: string;
}

export const createCheckoutSessionFunction = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const uid = requireAuth(request);
  const plan = normalizeCheckoutPlan((request.data as CreateCheckoutRequest | undefined)?.planKey);

  // Simulation mode: return an in-app fake-checkout URL with the same { url, id }
  // shape the client already consumes (window.location.assign). No Stripe keys or
  // price ids needed; the fake-payment page confirms via confirmSimulatedCheckout.
  if (billingSimulationEnabled()) {
    const simId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const params = new URLSearchParams({ plan: plan.plan, audience: plan.audience, sim: simId });
    return { url: `/billing/checkout?${params.toString()}`, id: simId, simulated: true };
  }

  const price = process.env[plan.priceEnv];
  if (!price) {
    throw new HttpsError("failed-precondition", `${plan.priceEnv} is not configured.`);
  }

  const baseUrl = appBaseUrl();
  const stripe = getStripe();
  const email = stringOrNull(request.auth?.token.email);
  const successPath = plan.audience === "business" ? "/portal?checkout=success" : "/workspace/billing?checkout=success";
  const cancelPath = plan.audience === "business" ? "/pricing?audience=employer&checkout=cancel" : "/pricing?checkout=cancel";

  const session = await stripe.checkout.sessions.create({
    mode: plan.mode,
    customer_email: email ?? undefined,
    client_reference_id: uid,
    line_items: [{ price, quantity: 1 }],
    success_url: `${baseUrl}${successPath}`,
    cancel_url: `${baseUrl}${cancelPath}`,
    metadata: {
      uid,
      plan_key: plan.plan,
      audience: plan.audience,
    },
    ...(plan.mode === "subscription"
      ? {
          subscription_data: {
            metadata: {
              uid,
              plan_key: plan.plan,
              audience: plan.audience,
            },
          },
        }
      : {}),
  });

  if (!session.url) {
    throw new HttpsError("internal", "Stripe did not return a Checkout URL.");
  }
  return { url: session.url, id: session.id };
});

interface ConfirmSimulatedCheckoutRequest {
  planKey: string;
}

/**
 * Simulated-payment confirmation (demo/test only). Mirrors the Stripe webhook's
 * checkout.session.completed → activateStripeEntitlement path, so the billing
 * entitlement record AND the plan/role/credit activation are IDENTICAL to a real
 * payment. Gated by BILLING_SIMULATION so it can never self-grant in production.
 */
export async function confirmSimulatedCheckoutImpl(uid: string, data: ConfirmSimulatedCheckoutRequest) {
  if (!billingSimulationEnabled()) {
    throw new HttpsError("failed-precondition", "Billing simulation is not enabled.");
  }
  const plan = normalizeCheckoutPlan(data?.planKey);
  const simId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return activateStripeEntitlement({
    uid,
    plan: plan.plan,
    audience: plan.audience,
    stripeCustomerId: `sim_cus_${uid.slice(0, 12)}`,
    stripeSubscriptionId: plan.mode === "subscription" ? `sim_sub_${simId}` : null,
    checkoutSessionId: simId,
    checkoutMode: plan.mode,
  });
}

export const confirmSimulatedCheckoutFunction = onCall((request) =>
  confirmSimulatedCheckoutImpl(requireAuth(request), (request.data ?? {}) as ConfirmSimulatedCheckoutRequest));

/**
 * Simulated subscription cancellation (demo/test only). Mirrors the Stripe
 * customer.subscription.deleted webhook's downgrade path — clearing billing.active
 * and resetting the user to free WITHOUT touching credits. Gated by
 * BILLING_SIMULATION so it can never bypass Stripe in production.
 */
export async function cancelSubscriptionSimulatedImpl(uid: string) {
  if (!billingSimulationEnabled()) {
    throw new HttpsError("failed-precondition", "Billing simulation is not enabled.");
  }
  const billingSnap = await db.collection(BILLING_COLLECTION).doc(uid).get();
  if (!billingSnap.exists || billingSnap.get("active") !== true) {
    return { status: "inactive" as const, subscription_status: "free" };
  }
  const audience = billingSnap.get("audience");
  const resolvedAudience: BillingAudience =
    audience === "business" ? "business" : "candidate";
  await deactivateStripeEntitlement({
    uid,
    audience: resolvedAudience,
    stripeSubscriptionId: billingSnap.get("stripe_subscription_id") ?? null,
    reason: "cancelled_simulated",
  });
  return { status: "cancelled" as const, subscription_status: "free" };
}

export const cancelSubscriptionSimulatedFunction = onCall((request) =>
  cancelSubscriptionSimulatedImpl(requireAuth(request)));

/**
 * Creates a billing-management entry point for the signed-in user.
 *   - Simulation mode: returns the in-app fake manage page URL.
 *   - Real mode: creates a Stripe Customer Portal session (cancel / change card /
 *     invoices). The customer id is read ONLY from the user's own billing doc —
 *     never accepted from the client — to prevent managing another user's billing.
 */
export async function createBillingPortalSessionImpl(uid: string): Promise<{ url: string; simulated?: boolean }> {
  if (billingSimulationEnabled()) {
    return { url: "/billing/manage", simulated: true };
  }
  const billingSnap = await db.collection(BILLING_COLLECTION).doc(uid).get();
  const customerId = billingSnap.get("stripe_customer_id");
  const audience = billingSnap.get("audience");
  if (!billingSnap.exists || billingSnap.get("active") !== true || typeof customerId !== "string" || !customerId) {
    throw new HttpsError("failed-precondition", "No active subscription to manage.");
  }
  const returnPath = billingPortalReturnPathForAudience(audience);
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appBaseUrl()}${returnPath}`,
  });
  if (!session.url) {
    throw new HttpsError("internal", "Stripe did not return a Billing Portal URL.");
  }
  return { url: session.url };
}

// No { secrets: [...] } declaration: in simulation mode this returns early and never
// touches Stripe, and real mode reads STRIPE_SECRET_KEY via the process.env fallback in
// getStripe()/secretOrEnv — so it deploys without requiring the secret to exist in
// Secret Manager. Wire STRIPE_SECRET_KEY into the functions env when going live.
export const createBillingPortalSessionFunction = onCall((request) =>
  createBillingPortalSessionImpl(requireAuth(request)));

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const uid = stringOrNull(session.metadata?.uid) ?? stringOrNull(session.client_reference_id);
  const plan = stringOrNull(session.metadata?.plan_key);
  const audience = session.metadata?.audience;
  if (!uid || !plan || (audience !== "candidate" && audience !== "business")) {
    logger.warn("stripeWebhook: checkout.session.completed missing entitlement metadata", { session: session.id });
    return;
  }

  await activateStripeEntitlement({
    uid,
    plan,
    audience,
    stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
    stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
    checkoutSessionId: session.id,
    checkoutMode: session.mode === "subscription" ? "subscription" : "payment",
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const uid = stringOrNull(subscription.metadata?.uid);
  const audience = subscription.metadata?.audience;
  const fallback = !uid || (audience !== "candidate" && audience !== "business")
    ? await findBillingBySubscription(subscription.id)
    : null;
  const resolvedUid = uid ?? fallback?.uid;
  const resolvedAudience = audience === "candidate" || audience === "business" ? audience : fallback?.audience;
  if (!resolvedUid || !resolvedAudience) {
    logger.warn("stripeWebhook: subscription.deleted missing entitlement metadata", { subscription: subscription.id });
    return;
  }
  await deactivateStripeEntitlement({
    uid: resolvedUid,
    audience: resolvedAudience,
    stripeSubscriptionId: subscription.id,
    reason: "cancelled",
  });
}

export const stripeWebhookFunction = onRequest({ secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const secret = getStripeWebhookSecret();
  if (!secret) {
    res.status(500).send("Stripe webhook is not configured.");
    return;
  }

  const signature = req.header("stripe-signature");
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (!signature || !rawBody) {
    res.status(400).send("Missing Stripe signature or raw body.");
    return;
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    logger.warn("stripeWebhook: signature verification failed", error);
    res.status(400).send("Invalid Stripe signature.");
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        logger.warn("stripeWebhook: invoice payment failed", {
          invoice: (event.data.object as Stripe.Invoice).id,
        });
        break;
      default:
        break;
    }
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error("stripeWebhook: handler failed", error);
    res.status(500).send("Stripe webhook handler failed.");
  }
});
