import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingFirebaseConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingFirebaseConfig.length > 0) {
  throw new Error(`Missing Firebase config: ${missingFirebaseConfig.join(', ')}`);
}

export const app = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
export const firestoreDb = getFirestore(app);
export const firebaseFunctions = getFunctions(
  app,
  import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1',
);

declare global {
  // Vite HMR can re-run this module in dev; Firebase only allows each emulator
  // connection to be registered once per app instance.
  // eslint-disable-next-line no-var
  var __careerCopilotFirebaseEmulatorsConnected: boolean | undefined;
}

if (
  import.meta.env.VITE_FIREBASE_USE_EMULATOR === 'true' &&
  !globalThis.__careerCopilotFirebaseEmulatorsConnected
) {
  connectAuthEmulator(
    firebaseAuth,
    import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9199',
    { disableWarnings: true },
  );
  connectFirestoreEmulator(
    firestoreDb,
    import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1',
    Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080),
  );
  connectFunctionsEmulator(
    firebaseFunctions,
    import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST || '127.0.0.1',
    Number(import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT || 5001),
  );
  globalThis.__careerCopilotFirebaseEmulatorsConnected = true;
}
