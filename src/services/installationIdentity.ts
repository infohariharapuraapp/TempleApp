import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
const INSTALLATION_SECRET_KEY =
  'temple_installation_secret_v1';
const SECRET_PATTERN = /^[a-f0-9]{64}$/;
let pendingIdentity: Promise<string> | null = null;
async function loadOrCreateIdentity(): Promise<string> {
  if (
    Platform.OS !== 'android' &&
    Platform.OS !== 'ios'
  ) {
    throw new Error('Unsupported installation platform');
  }
  const available = await SecureStore.isAvailableAsync();
  if (!available) {
    throw new Error('Secure installation storage unavailable');
  }
  const existing = await SecureStore.getItemAsync(
    INSTALLATION_SECRET_KEY
  );
  if (existing !== null) {
    if (!SECRET_PATTERN.test(existing)) {
      throw new Error('Invalid stored installation identity');
    }
    return existing;
  }
  const bytes = await Crypto.getRandomBytesAsync(32);
  const secret = Array.from(
    bytes,
    byte => byte.toString(16).padStart(2, '0')
  ).join('');
  if (!SECRET_PATTERN.test(secret)) {
    throw new Error('Installation identity generation failed');
  }
  await SecureStore.setItemAsync(
    INSTALLATION_SECRET_KEY,
    secret,
    {
      keychainAccessible:
        SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }
  );
  const stored = await SecureStore.getItemAsync(
    INSTALLATION_SECRET_KEY
  );
  if (stored !== secret) {
    throw new Error('Installation identity storage failed');
  }
  return secret;
}
export async function getInstallationSecret():
  Promise<string> {
  if (pendingIdentity) {
    return pendingIdentity;
  }
  const operation = loadOrCreateIdentity();
  pendingIdentity = operation;
  try {
    return await operation;
  } finally {
    if (pendingIdentity === operation) {
      pendingIdentity = null;
    }
  }
}