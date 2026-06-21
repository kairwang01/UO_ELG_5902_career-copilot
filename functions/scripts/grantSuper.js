/**
 * Grant SUPER admin to a user by email — proper RBAC store.
 *
 * Writes platform_config/access.admins[uid] = { role:'super', status:'active', ... }
 * which is resolution path (b) in functions/src/admin/roles.ts → role 'super'.
 * Takes effect within ≤60s (the access-doc cache TTL) — NO redeploy needed, and
 * it stays revocable from the Admin Portal (unlike the ADMIN_UIDS env bootstrap).
 *
 * AUTH: Application Default Credentials. In Cloud Shell this is automatic.
 *   Local: run `gcloud auth application-default login` first.
 *
 * RUN:
 *   cd functions
 *   node scripts/grantSuper.js [email]      # default: mizi99207@gmail.com
 */
const admin = require("firebase-admin");

const projectId = process.env.GCLOUD_PROJECT || "career-copilot-a3168";
admin.initializeApp({ projectId });

const email = process.argv[2] || "mizi99207@gmail.com";

(async () => {
  const user = await admin.auth().getUserByEmail(email);

  const ref = admin.firestore().collection("platform_config").doc("access");
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : {};
  const admins = { ...(data.admins || {}) };

  admins[user.uid] = {
    role: "super",
    email,
    status: "active",
    invited_by: "bootstrap-script",
    invited_at: new Date().toISOString(),
  };

  await ref.set({ admins, updated_at: new Date().toISOString() }, { merge: true });

  // Compatibility claim (RBAC reads Firestore; some older gates check this claim).
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });

  console.log(`✅ ${email} (${user.uid}) is now SUPER admin.`);
  console.log("   Effective within ~60s (access-doc cache). Sign out/in to refresh the ID-token claim.");
  process.exit(0);
})().catch((e) => {
  console.error("Failed:", e.message || e);
  process.exit(1);
});
