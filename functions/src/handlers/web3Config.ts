/**
 * Web3 feature configuration.
 *
 * The Web3 module is optional and testnet-only. Candidate-facing surfaces need
 * a public, non-sensitive read path; admin mutation stays behind the super role
 * and writes the admin audit log.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { PLATFORM_CONFIG_COLLECTION, PLATFORM_DOCS } from "../admin/schema";
import { requireRole } from "../admin/roles";
import { logAdminAction } from "../admin/usageLog";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const CONTRACT_ADDRESS = "0x2A3b1A43842238321a22542a035921A362358189";

export interface Web3ConfigResponse {
  enabled: boolean;
  network: "sepolia";
  chain_id: 11155111;
  contract_address: string;
  updated_at: string | null;
  updated_by: string | null;
}

function iso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof value === "string" ? value : null;
}

function coerceConfig(data: admin.firestore.DocumentData | undefined): Web3ConfigResponse {
  return {
    enabled: data?.enabled === true,
    network: "sepolia",
    chain_id: 11155111,
    contract_address: CONTRACT_ADDRESS,
    updated_at: iso(data?.updated_at),
    updated_by: typeof data?.updated_by === "string" ? data.updated_by : null,
  };
}

export async function getWeb3ConfigImpl(): Promise<Web3ConfigResponse> {
  const snap = await db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.web3).get();
  return coerceConfig(snap.exists ? snap.data() : undefined);
}

export async function updateWeb3ConfigImpl(uid: string, data: Record<string, unknown>): Promise<Web3ConfigResponse> {
  if (typeof data.enabled !== "boolean") {
    throw new HttpsError("invalid-argument", "enabled must be a boolean.");
  }
  const ref = db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.web3);
  await ref.set({
    enabled: data.enabled,
    network: "sepolia",
    chain_id: 11155111,
    contract_address: CONTRACT_ADDRESS,
    updated_at: FieldValue.serverTimestamp(),
    updated_by: uid,
  }, { merge: true });
  await logAdminAction({
    admin_uid: uid,
    action: "update_web3_config",
    details: { enabled: data.enabled, network: "sepolia", chain_id: 11155111 },
  });
  return {
    enabled: data.enabled,
    network: "sepolia",
    chain_id: 11155111,
    contract_address: CONTRACT_ADDRESS,
    updated_at: new Date().toISOString(),
    updated_by: uid,
  };
}

export const getWeb3ConfigFunction = onCall({ invoker: "public" }, () => getWeb3ConfigImpl());

export const adminGetWeb3ConfigFunction = onCall({ invoker: "public" }, async (request) => {
  await requireRole(request, "super");
  return getWeb3ConfigImpl();
});

export const adminUpdateWeb3ConfigFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid } = await requireRole(request, "super");
  return updateWeb3ConfigImpl(uid, request.data ?? {});
});
