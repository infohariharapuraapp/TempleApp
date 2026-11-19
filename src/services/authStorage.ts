import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'temple_app_jwt';

// Serialize token operations to prevent overlapping
// login, logout and session cleanup operations.

let storageQueue: Promise<void> = Promise.resolve();

function serializeStorage<T>(
  operation: () => Promise<T>
): Promise<T> {
  const result = storageQueue.then(operation);

  storageQueue = result.then(
    () => undefined,
    () => undefined
  );

  return result;
}

async function readStoredToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function deleteStoredToken(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function saveToken(token: string): Promise<void> {
  return serializeStorage(async () => {
    if (Platform.OS === 'web') {
      localStorage.setItem(TOKEN_KEY, token);
      return;
    }

    await SecureStore.setItemAsync(TOKEN_KEY, token);
  });
}

export function getToken(): Promise<string | null> {
  return serializeStorage(readStoredToken);
}

export function removeToken(): Promise<void> {
  return serializeStorage(deleteStoredToken);
}

// Remove only the session that was originally validated.
// Prevent an older request from deleting a newer login.

export function removeTokenIfMatches(
  expectedToken: string
): Promise<boolean> {
  return serializeStorage(async () => {
    const currentToken = await readStoredToken();

    if (currentToken !== expectedToken) {
      return false;
    }

    await deleteStoredToken();

    return true;
  });
}