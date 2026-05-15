import admin from 'firebase-admin';

let firestore: admin.firestore.Firestore | null = null;

// firebase-admin's TS types vary across versions; the runtime `admin.credential`
// exists, but its TS shape has changed across upgrades.
// Use a loose cast here so `tsc` doesn't fail with "unknown is not assignable
// to Credential" across versions.
const credentialFactory = (admin as any).credential as any;

const initFromServiceAccountEnv = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return false;

  // FIREBASE_SERVICE_ACCOUNT is expected to be a JSON string.
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  admin.initializeApp({
    credential: credentialFactory.cert(parsed),
  });

  firestore = admin.firestore();
  return true;
};

export const getFirestore = (): admin.firestore.Firestore => {
  if (firestore) return firestore;

  // First, try explicit service account JSON (best for deterministic boot + local dev).
  const ok = initFromServiceAccountEnv();
  if (ok && firestore) return firestore;

  // IMPORTANT:
  // Do NOT fall back to ADC in local dev. ADC credential resolution can hang (network / metadata)
  // which breaks request responsiveness even though routes try to fall back to memoryStore.
  throw new Error('Firebase Admin: missing FIREBASE_SERVICE_ACCOUNT (no ADC fallback).');
};
