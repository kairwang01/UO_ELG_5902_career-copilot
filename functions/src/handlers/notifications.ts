/**
 * notifications — Firestore-triggered Cloud Functions.
 *
 * onApplicationStatusChangeFunction:
 *   Fires on UPDATE of a job_applications document (not create/delete), and acts
 *   only when before.status !== after.status.
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
import { classifyTransition, renderInterviewProgressEmail } from "../email/interviewProgress";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Where the candidate logs in to view "My Applications". Overridable per env.
const APP_BASE_URL = process.env.APP_BASE_URL || "https://uottawa-5902-demo-copilot.kairwang.cloud";

// Firestore doc ids can't contain "/"; keep them tidy and deterministic.
const safeId = (s: string): string => s.replace(/[^A-Za-z0-9_-]/g, "_");

// create() throws ALREADY_EXISTS (gRPC code 6) when the deterministic id is
// re-used — that just means we already wrote this exact transition. Swallow it.
const swallowAlreadyExists = (err: unknown): void => {
  const code = (err as { code?: number | string })?.code;
  if (code === 6 || code === "already-exists") return;
  console.error("notifications: write failed", err);
};

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
      // Normalize once so the in-app feed and the email dedupe on the SAME key.
      const { kind, status } = classifyTransition(before.status, after.status);

      // 1) In-app notification — deterministic id per (application, normalized
      //    status) so an employer toggling a stage back and forth can't flood the
      //    candidate's feed (one notification per distinct stage reached).
      // Candidate-facing note the employer attached to this transition (the
      // internal `reason` is never surfaced — it stays in the audit event).
      const candidateNote = typeof after.last_status_note === "string" ? after.last_status_note : null;
      const notifRef = db
        .collection("users")
        .doc(candidateId)
        .collection("notifications")
        .doc(safeId(`${appId}_${status}`));
      await notifRef
        .create({
          type: "application_status",
          application_id: appId,
          job_title: after.job_title ?? null,
          status,
          candidate_note: candidateNote,
          read: false,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(async (err) => {
          // Stage already reached: refresh the candidate-facing note (the employer
          // may have edited it on a re-save) and resurface it unread. Admin SDK
          // bypasses the owner-only update rule.
          if ((err as { code?: number | string })?.code === 6 || (err as { code?: string })?.code === "already-exists") {
            await notifRef
              .set({ candidate_note: candidateNote, read: false, updated_at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
              .catch((e) => console.error("notifications: note refresh failed", e));
            return;
          }
          swallowAlreadyExists(err);
        });

      // 2) Email the candidate on a meaningful forward stage change (best-effort).
      //    Delivered by the Firebase "Trigger Email" extension watching `mail`.
      if (kind) {
        // company/location live on the job posting, not on the application.
        let company = "";
        let location = "";
        try {
          const jobSnap = await db.collection("job_postings").doc(String(after.job_id)).get();
          company = (jobSnap.data()?.company_name as string) ?? "";
          location = (jobSnap.data()?.location as string) ?? "";
        } catch { /* non-fatal */ }

        // recipient + display name + language — the user doc rarely stores email,
        // so fall back to the authoritative Firebase Auth record.
        const userSnap = await db.collection("users").doc(candidateId).get();
        const u = (userSnap.data() ?? {}) as Record<string, unknown>;
        let email = typeof u.email === "string" ? u.email : "";
        if (!email) {
          try { email = (await admin.auth().getUser(candidateId)).email ?? ""; } catch { /* */ }
        }

        if (email) {
          const candidateName = (typeof u.full_name === "string" && u.full_name.trim())
            ? u.full_name.trim()
            : (typeof after.candidate_name === "string" ? after.candidate_name : "");
          const rendered = renderInterviewProgressEmail({
            lang: typeof u.preferred_language === "string" ? u.preferred_language : "en",
            kind,
            candidateName,
            jobTitle: typeof after.job_title === "string" ? after.job_title : "the role",
            company,
            location,
            status,
            appId,
            baseUrl: APP_BASE_URL,
          });
          // Idempotent enqueue: one email per (application, status) even on retries.
          await db
            .collection("mail")
            .doc(safeId(`${appId}_${status}`))
            .create({
              to: [email],
              message: { subject: rendered.subject, html: rendered.html, text: rendered.text },
              _meta: {
                type: "application_progress",
                application_id: appId,
                candidate_id: candidateId,
                status,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
              },
            })
            .catch(swallowAlreadyExists);
        }
      }
    } catch (err) {
      // Best-effort — log but never throw so the function doesn't retry
      // and cause credit-draining loops.
      console.error("onApplicationStatusChange: failed to write notification", err);
    }
  }
);
