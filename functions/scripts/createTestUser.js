/**
 * Create (or upgrade) a MAX-TIER test user for trying the multi-model picker.
 *
 * The "executive" subscription_status maps to the "premium" tier, so this user
 * sees every model (incl. the KAIRLLM "auto" gateway) in the picker.
 *
 * AUTH (pick one before running):
 *   - `gcloud auth application-default login`  (uses your Google login), or
 *   - export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *
 * RUN:
 *   cd functions
 *   node scripts/createTestUser.js [email] [password]
 *
 * Defaults: tester@career-copilot.test / TestUser!2026
 */
const admin = require("firebase-admin");

const projectId = process.env.GCLOUD_PROJECT || "career-copilot-a3168";
admin.initializeApp({ projectId });

const email = process.argv[2] || "tester@career-copilot.test";
const password = process.argv[3] || "TestUser!2026";

(async () => {
  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password, emailVerified: true });
    console.log("Existing user updated:", user.uid);
  } catch {
    user = await admin.auth().createUser({
      email,
      password,
      emailVerified: true,
      displayName: "Test User (Executive)",
    });
    console.log("Created user:", user.uid);
  }

  const now = new Date().toISOString();
  await admin
    .firestore()
    .collection("users")
    .doc(user.uid)
    .set(
      {
        credits: 100000,
        role: "candidate",
        subscription_status: "executive", // → premium tier → all models unlocked
        full_name: "Test User (Executive)",
        avatar_url: null,
        created_at: now,
        updated_at: now,
      },
      { merge: true }
    );

  console.log(`\n✅ users/${user.uid} → executive tier, 100000 credits`);
  console.log(`   Login:  ${email}  /  ${password}`);
  console.log(`   This account sees every model in the picker (incl. KAIRLLM "auto").`);
  process.exit(0);
})().catch((e) => {
  console.error("Failed:", e.message || e);
  process.exit(1);
});
