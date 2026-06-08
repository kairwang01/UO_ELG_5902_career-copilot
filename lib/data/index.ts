// Single entry point for front-end data access. Components import `data` from here.
// To change backends, point this one binding at a different adapter.

import { firebaseDataClient } from './firebaseDataClient';
import type { DataClient } from './DataClient';

export const data: DataClient = firebaseDataClient;

export type {
  DataClient,
  DataResult,
  DataError,
  Subscription,
  AppSession,
  AppUser,
  AppAuthEvent,
  ApiKey,
  AuthApi,
  ProfilesApi,
  ApiKeysApi,
} from './DataClient';
