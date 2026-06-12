/**
 * One-time admin script to set a user's roles and status.
 *
 * SETUP (once):
 *   1. Firebase Console → Project Settings → Service Accounts
 *   2. "Generate new private key" → save as  service-account.json  in project root
 *   3. service-account.json is already in .gitignore — never commit it!
 *
 * USAGE:
 *   node scripts/set-user-roles.mjs <email> [role1 role2 ...]
 *
 * EXAMPLES:
 *   node scripts/set-user-roles.mjs jsivacik@gmail.com
 *   node scripts/set-user-roles.mjs jsivacik@gmail.com admin chronicler contributor
 *   node scripts/set-user-roles.mjs other@example.com contributor
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SA_PATH = resolve(__dirname, "..", "service-account.json");

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(SA_PATH, "utf-8"));
} catch {
  console.error("❌  service-account.json not found at:", SA_PATH);
  console.error("   Download it from Firebase Console → Project Settings → Service Accounts");
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const auth = getAuth();

const VALID_ROLES = ["admin", "chronicler", "contributor"];
const email = process.argv[2];
const roleArgs = process.argv.slice(3);
const roles = roleArgs.length > 0 ? roleArgs : VALID_ROLES;

if (!email) {
  console.error("Usage: node scripts/set-user-roles.mjs <email> [roles...]");
  process.exit(1);
}

for (const r of roles) {
  if (!VALID_ROLES.includes(r)) {
    console.error(`❌  Invalid role: "${r}". Allowed: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }
}

async function main() {
  // Resolve Firebase Auth UID from email
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch {
    console.error(`❌  User "${email}" not found in Firebase Auth.`);
    console.error("   The user must sign in at least once before roles can be assigned.");
    process.exit(1);
  }

  const { uid, displayName } = userRecord;
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();

  if (snap.exists) {
    await ref.update({
      roles,
      status: "active",
      updatedAt: new Date(),
    });
  } else {
    // First sign-in document not yet created — create it now
    await ref.set({
      uid,
      email,
      displayName: displayName ?? "",
      photoURL: userRecord.photoURL ?? null,
      roles,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  console.log(`✓  ${email} (${uid})`);
  console.log(`   Meno:   ${displayName ?? "—"}`);
  console.log(`   Status: active`);
  console.log(`   Role:   ${roles.join(", ")}`);
}

main().catch((err) => {
  console.error("❌  Error:", err.message);
  process.exit(1);
});
