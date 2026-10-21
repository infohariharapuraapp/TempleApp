
type AuthListener = (authenticated: boolean) => void;

const listeners = new Set<AuthListener>();

export function subscribeAuth(
  listener: AuthListener
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function notifyAuthChanged(
  authenticated: boolean
): void {
  listeners.forEach((listener) => {
    listener(authenticated);
  });
}
