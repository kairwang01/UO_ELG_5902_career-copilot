// Supabase implementation of the DataClient contract. This is the only file in the
// front end that knows about Supabase tables, RPCs, and auth. A Firebase adapter would
// implement the same interface and `lib/data/index.ts` would point at it instead.

import { supabase } from '../supabaseClient';
import type { UserProfile } from '../../types';
import type {
  DataClient,
  DataResult,
  AppSession,
  AppUser,
  Subscription,
  ApiKey,
} from './DataClient';

// Supabase errors are rich objects; the app only ever reads `.message`.
const toError = (error: { message: string } | null): DataResult<unknown>['error'] =>
  error ? { message: error.message } : null;

export const supabaseDataClient: DataClient = {
  auth: {
    async getSession(): Promise<AppSession | null> {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
    onAuthStateChange(handler): Subscription {
      const { data } = supabase.auth.onAuthStateChange((event, session) => handler(event, session));
      return { unsubscribe: () => data.subscription.unsubscribe() };
    },
    async signInWithPassword(email, password): Promise<DataResult<AppSession>> {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      return { data: data.session, error: toError(error) };
    },
    async signUp(email, password): Promise<DataResult<AppUser>> {
      const { data, error } = await supabase.auth.signUp({ email, password });
      return { data: data.user, error: toError(error) };
    },
    async signInWithGoogle(): Promise<DataResult<void>> {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      return { data: null, error: toError(error) };
    },
    async signOut(scope = 'global'): Promise<DataResult<void>> {
      const { error } = await supabase.auth.signOut({ scope });
      return { data: null, error: toError(error) };
    },
    async resetPassword(email): Promise<DataResult<void>> {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return { data: null, error: toError(error) };
    },
    async updatePassword(password): Promise<DataResult<AppUser>> {
      const { data, error } = await supabase.auth.updateUser({ password });
      return { data: data.user, error: toError(error) };
    },
  },

  profiles: {
    async get(userId): Promise<DataResult<UserProfile>> {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      return { data: (data as UserProfile) ?? null, error: toError(error) };
    },
    async upsert(profile): Promise<DataResult<void>> {
      const { error } = await supabase.from('profiles').upsert(profile as never);
      return { data: null, error: toError(error) };
    },
    async update(userId, patch): Promise<DataResult<void>> {
      const { error } = await supabase.from('profiles').update(patch as never).eq('id', userId);
      return { data: null, error: toError(error) };
    },
  },

  apiKeys: {
    async list(userId): Promise<DataResult<ApiKey[]>> {
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, key_name, created_at, last_used_at, request_count')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      return { data: (data as ApiKey[]) ?? null, error: toError(error) };
    },
    async create(userId, keyName): Promise<DataResult<string>> {
      const { data, error } = await supabase.rpc('create_api_key', {
        p_user_id: userId,
        p_key_name: keyName,
      });
      return { data: (data as string) ?? null, error: toError(error) };
    },
    async remove(keyId, userId): Promise<DataResult<void>> {
      const { error } = await supabase.rpc('delete_api_key', {
        p_key_id: keyId,
        p_user_id: userId,
      });
      return { data: null, error: toError(error) };
    },
  },
};
