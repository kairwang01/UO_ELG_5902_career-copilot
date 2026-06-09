/**
 * Grant admin portal access to a user by email.
 *
 * RUN:
 *   cd functions
 *   node scripts/grantAdmin.js your@email.com
 *
 * Requires Application Default Credentials (gcloud auth application-default login).
 */
const admin = require("firebase-admin");

const projectId = process.env.GCLOUD_PROJECT || "career-copilot-a3168";
admin.initializeApp({ projectId });

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/grantAdmin.js <email>");
  process.exit(1);
}

(async () => {
  const user = await admin.auth().getUserByEmail(email);
  const ref = admin.firestore().collection("platform_config").doc("access");
  const snap = await ref.get();
  const admin_uids = snap.exists ? [...(snap.data().admin_uids || [])] : [];
  if (!admin_uids.includes(user.uid)) admin_uids.push(user.uid);
  await ref.set({ admin_uids, updated_at: new Date().toISOString() }, { merge: true });

  // Optional: also set custom claim for faster checks
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });

  console.log(`✅ ${email} (${user.uid}) is now an admin.`);
  console.log("   Sign out and sign back in so the ID token picks up the admin claim.");
  process.exit(0);
})().catch((e) => {
  console.error("Failed:", e.message || e);
  process.exit(1);
});
