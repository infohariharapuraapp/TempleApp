import * as SecureStore from 'expo-secure-store';
const VERSION_KEY = 'temple_device_binding_version_v1';
const MAX_VERSION = 2147483647;
let versionQueue: Promise<void> = Promise.resolve();
export function nextDeviceBindingVersion(): Promise<number> {
  const operation = versionQueue.then(async () => {
    const stored = await SecureStore.getItemAsync(VERSION_KEY);
    if (stored !== null && !/^(0|[1-9][0-9]*)$/.test(stored)) {
      throw new Error('Invalid stored device binding version');
    }
    const current = stored === null ? 0 : Number(stored);
    if (
      !Number.isSafeInteger(current) ||
      current < 0 ||
      current >= MAX_VERSION
    ) {
      throw new Error('Device binding version unavailable');
    }
    const next = current + 1;
    await SecureStore.setItemAsync(
      VERSION_KEY,
      String(next),
      {
        keychainAccessible:
          SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }
    );
    const confirmed = await SecureStore.getItemAsync(VERSION_KEY);
    if (confirmed !== String(next)) {
      throw new Error('Device binding version storage failed');
    }
    return next;
  });
  versionQueue = operation.then(
    () => undefined,
    () => undefined
  );
  return operation;
}