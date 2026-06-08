// Firebase implementation of the DataClient contract.
// Replaces supabaseDataClient — the rest of the app is untouched.
//
// AppSession / AppUser are still typed as Supabase shapes in DataClient.ts
// (the one acknowledged seam). Here we return Firebase-backed objects cast
// to those shapes. The only fields the app actually reads are:
//   session.user.id, session.user.email,
//   user.user_metadata.full_name, user.user_metadata.avatar_url
// — all of which Firebase provides via uid / email / displayName / photoURL.

import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updatePassword as fbUpdatePassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { app } from '../firebaseClient';
import type { UserProfile } from '../../types';
import type {
  DataClient,
  DataResult,
  AppSession,
  AppUser,
  Subscription,
  ApiKey,
} from './DataClient';

const auth = getAuth(app);
const db = getFirestore(app);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a Firebase User to the AppUser shape the app expects. */
function toAppUser(fbUser: FirebaseUser): AppUser {
  return {
    id: fbUser.uid,
    email: fbUser.email ?? '',
    user_metadata: {
      full_name: fbUser.displayName ?? '',
      avatar_url: fbUser.photoURL ?? '',
    },
    // Supabase-compat stubs (app never reads these for Firebase users)
    app_metadata: {},
    aud: 'authenticated',
    created_at: '',
  } as unknown as AppUser;
}

/** Wrap a Firebase User in an AppSession-compatible object. */
function toAppSession(fbUser: FirebaseUser): AppSession {
  return {
    user: toAppUser(fbUser),
    access_token: '',   // not used; Firebase callable functions use ID tokens internally
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 0,
  } as unknown as AppSession;
}

/** Convert any error to a DataResult error. */
function toError(err: unknown): DataResult<unknown>['error'] {
  if (err instanceof Error) return { message: err.message };
  return { message: String(err) };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export const firebaseDataClient: DataClient = {
  auth: {
    async getSession(): Promise<AppSession | null> {
      const user = auth.currentUser;
      return user ? toAppSession(user) : null;
    },

    onAuthStateChange(handler): Subscription {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          handler('SIGNED_IN' as any, toAppSession(user));
        } else {
          handler('SIGNED_OUT' as any, null);
        }
      });
      return { unsubscribe };
    },

    async signInWithPassword(email, password): Promise<DataResult<AppSession>> {
      try {
        const { user } = await signInWithEmailAndPassword(auth, email, password);
        return { data: toAppSession(user), error: null };
      } catch (err) {
        return { data: null, error: toError(err) };
      }
    },

    async signUp(email, password): Promise<DataResult<AppUser>> {
      try {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        return { data: toAppUser(user), error: null };
      } catch (err) {
        return { data: null, error: toError(err) };
      }
    },

    async signInWithGoogle(): Promise<DataResult<void>> {
      try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        return { data: null, error: null };
      } catch (err) {
        return { data: null, error: toError(err) };
      }
    },

    async signOut(): Promise<DataResult<void>> {
      try {
        await fbSignOut(auth);
        return { data: null, error: null };
      } catch (err) {
        return { data: null, error: toError(err) };
      }
    },

    async resetPassword(email): Promise<DataResult<void>> {
      try {
        await sendPasswordResetEmail(auth, email);
        return { data: null, error: null };
      } catch (err) {
        return { data: null, error: toError(err) };
      }
    },

    async updatePassword(password): Promise<DataResult<AppUser>> {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error('Not signed in.');
        await fbUpdatePassword(user, password);
        return { data: toAppUser(user), error: null };
      } catch (err) {
        return { data: null, error: toError(err) };
      }
    },
  },

  profiles: {
    async get(userId): Promise<DataResult<UserProfile>> {
      try {
        const snap = await getDoc(doc(db, 'users', userId));
        if (!snap.exists()) return { data: null, error: { message: 'Profile not found.' } };
        return { data: { id: userId, ...snap.data() } as UserProfile, error: null };
      } catch (err) {
        return { data: null, error: toError(err) };
      }
    },

    async upsert(profile): Promise<DataResult<void>> {
      try {
        const { id, ...rest } = profile;
        await setDoc(doc(db, 'users', id), { ...rest, updated_at: new Date().toISOString() }, { merge: true });
        return { data: null, error: null };
      } catch (err) {
        return { data: null, error: toError(err) };
      }
    },

    async update(userId, patch): Promise<DataResult<void>> {
      try {
        await updateDoc(doc(db, 'users', userId), { ...patch, updated_at: new Date().toISOString() });
        return { data: null, error: null };
      } catch (err) {
        return { data: null, error: toError(err) };
      }
    },
  },

  // API keys are a Phase C feature (public developer API).
  // Stubbed for MVP — the UI sections that use these are gated behind conditions
  // that will not trigger in the demo flow.
  apiKeys: {
    async list(): Promise<DataResult<ApiKey[]>> {
      return { data: [], error: null };
    },
    async create(): Promise<DataResult<string>> {
      return { data: null, error: { message: 'API keys not yet available.' } };
    },
    async remove(): Promise<DataResult<void>> {
      return { data: null, error: { message: 'API keys not yet available.' } };
    },
  },
};
