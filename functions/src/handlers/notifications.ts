/**
 * notifications — Firestore-triggered Cloud Functions.
 *
 * onApplicationStatusChangeFunction:
 *   Fires whenever a job_applications document is written.
 *   When before.status !== after.status, writes a notification doc to
 *   users/{candidate_id}/notifications/{auto} so the candidate learns
 *   their application moved through the hiring funnel.
 *
 *   Best-effort: the whole handler is wrapped in try/catch and never throws.
 *   A missed notification is preferable to a Cloud Function retry loop.
 *
 * Region is inherited from setGlobalOptions() in index.ts (us-central1).
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const onApplicationStatusChangeFunction = onDocumentUpdated(
  "job_applications/{appId}",
  async (event) => {
    try {
      const before = event.data?.before?.data();
      const after = event.data?.after?.data();

      // Nothing to do if we can't read both snapshots.
      if (!before || !after) return;

      // Only act when status actually changed.
      if (before.status === after.status) return;

      const candidateId: string | undefined = after.candidate_id;
      if (!candidateId) return;

      const appId = event.params.appId;

      await db
        .collection("users")
        .doc(candidateId)
        .collection("notifications")
        .add({
          type: "application_status",
          application_id: appId,
          job_title: after.job_title ?? null,
          status: after.status,
          read: false,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (err) {
      // Best-effort — log but never throw so the function doesn't retry
      // and cause credit-draining loops.
      console.error("onApplicationStatusChange: failed to write notification", err);
    }
  }
);
