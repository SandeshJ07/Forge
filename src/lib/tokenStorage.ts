import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'forge_access_token';
const REFRESH_TOKEN_KEY = 'forge_refresh_token';
const USER_ID_KEY = 'forge_user_id';
const USERNAME_KEY = 'forge_username';

/**
 * expo-secure-store has no web implementation (there's no OS keychain in a
 * browser), so web falls back to localStorage — the same trust model any
 * web app's session already has. Native uses Keychain/Keystore.
 */
async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export interface StoredSession {
  userId: string;
  username: string;
  accessToken: string;
  refreshToken: string;
}

export async function loadStoredSession(): Promise<StoredSession | null> {
  const [userId, username, accessToken, refreshToken] = await Promise.all([
    getItem(USER_ID_KEY),
    getItem(USERNAME_KEY),
    getItem(ACCESS_TOKEN_KEY),
    getItem(REFRESH_TOKEN_KEY),
  ]);
  if (!userId || !username || !accessToken || !refreshToken) return null;
  return { userId, username, accessToken, refreshToken };
}

export async function saveSession(session: StoredSession): Promise<void> {
  await Promise.all([
    setItem(USER_ID_KEY, session.userId),
    setItem(USERNAME_KEY, session.username),
    setItem(ACCESS_TOKEN_KEY, session.accessToken),
    setItem(REFRESH_TOKEN_KEY, session.refreshToken),
  ]);
}

export async function clearStoredSession(): Promise<void> {
  await Promise.all([
    removeItem(USER_ID_KEY),
    removeItem(USERNAME_KEY),
    removeItem(ACCESS_TOKEN_KEY),
    removeItem(REFRESH_TOKEN_KEY),
  ]);
}
