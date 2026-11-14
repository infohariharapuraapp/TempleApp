// ========================================
// TRANSLATION RESPONSE DEADLINE
// ========================================
export const PUBLIC_TRANSLATION_TIMEOUT_MS = 3500;
export async function withTranslationDeadline<T>(
  task: Promise<T>,
  fallback: T,
  timeoutMs: number = PUBLIC_TRANSLATION_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task.catch(() => fallback),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => {
          resolve(fallback);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
