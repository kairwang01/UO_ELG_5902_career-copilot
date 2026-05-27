// Backend-agnostic data-access contract for the front end.
// Components talk to this interface, never to a concrete backend (Supabase today,
// Firebase later). Swapping backends means writing a new adapter, not editing UI.

import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import type { UserProfile } from '../../types';

// One acknowledged seam: session/user/event are still the Supabase shapes so we don't
// have to retype every `Session` prop across the app yet. On the Firebase move, redefine
// these three and adjust the adapter; the components stay untouched.
export type AppSession = Session;
export type AppUser = User;
export type AppAuthEvent = AuthChangeEvent;

export interface DataError {
  message: string;
}

// Mirrors the { data, error } shape the app already expects, minus the backend specifics.
export interface DataResult<T> {
  data: T | null;
  error: DataError | null;
}

export interface Subscription {
  unsubscribe: () => void;
}

export interface ApiKey {
  id: number;
  key_name: string;
  created_at: string;
  last_used_at: string | null;
  request_count: number;
}

export interface AuthApi {
  getSession(): Promise<AppSession | null>;
  onAuthStateChange(handler: (event: AppAuthEvent, session: AppSession | null) => void): Subscription;
  signInWithPassword(email: string, password: string): Promise<DataResult<AppSession>>;
  signUp(email: string, password: string): Promise<DataResult<AppUser>>;
  signInWithGoogle(): Promise<DataResult<void>>;
  signOut(scope?: 'local' | 'global'): Promise<DataResult<void>>;
  resetPassword(email: string): Promise<DataResult<void>>;
  updatePassword(password: string): Promise<DataResult<AppUser>>;
}

export interface ProfilesApi {
  get(userId: string): Promise<DataResult<UserProfile>>;
  upsert(profile: Partial<UserProfile> & { id: string }): Promise<DataResult<void>>;
  update(userId: string, patch: Partial<UserProfile>): Promise<DataResult<void>>;
}

export interface ApiKeysApi {
  list(userId: string): Promise<DataResult<ApiKey[]>>;
  create(userId: string, keyName: string): Promise<DataResult<string>>;
  remove(keyId: number, userId: string): Promise<DataResult<void>>;
}

// The full contract. New domains (jobs, applications, analyses, insights, tool events,
// file storage) follow the same pattern and get added here as each view is migrated.
export interface DataClient {
  auth: AuthApi;
  profiles: ProfilesApi;
  apiKeys: ApiKeysApi;
}
