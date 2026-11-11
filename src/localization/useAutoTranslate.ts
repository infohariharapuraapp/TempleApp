
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '@/services/api';

type Language = 'en' | 'te' | 'kn' | 'hi' | 'ta';

const LANGUAGES: Language[] = [
  'en', 'te', 'kn', 'hi', 'ta',
];

const MAX_BATCH_ITEMS = 10;
const MAX_BATCH_CHARACTERS = 1500;
const MAX_TEXT_LENGTH = 500;

// Keep requests below the backend's
// current limit of 10 per minute.
const REQUEST_INTERVAL_MS = 6500;

const translationCache = new Map<string, string>();

const listeners = new Map<
  string,
  Set<(value: string) => void>
>();

type PendingItem = {
  text: string;
  language: Language;
};

const pending = new Map<string, PendingItem>();

let processing = false;
let nextRequestAt = 0;
let wakeTimer: ReturnType<typeof setTimeout> | null = null;

function getKey(
  text: string,
  language: Language
): string {
  return JSON.stringify([language, text]);
}

function normalizeLanguage(value: string): Language {
  const code = value.toLowerCase().split('-')[0];

  return LANGUAGES.includes(code as Language)
    ? (code as Language)
    : 'en';
}

function publish(key: string, value: string) {
  translationCache.set(key, value);

  listeners.get(key)?.forEach((callback) => {
    callback(value);
  });
}

function subscribe(
  key: string,
  callback: (value: string) => void
) {
  const group = listeners.get(key) ?? new Set();

  group.add(callback);
  listeners.set(key, group);

  return () => {
    group.delete(callback);

    if (group.size === 0) {
      listeners.delete(key);
    }
  };
}

function scheduleProcessing(delay = 100) {
  if (processing || wakeTimer !== null) {
    return;
  }

  wakeTimer = setTimeout(() => {
    wakeTimer = null;
    void processQueue();
  }, delay);
}

async function processQueue() {
  if (processing || pending.size === 0) {
    return;
  }

  const now = Date.now();

  if (now < nextRequestAt) {
    scheduleProcessing(nextRequestAt - now);
    return;
  }

  processing = true;

  const first = pending.values().next().value as
    | PendingItem
    | undefined;

  if (!first) {
    processing = false;
    return;
  }

  const language = first.language;
  const batch: PendingItem[] = [];
  let totalCharacters = 0;

  for (const item of pending.values()) {
    if (item.language !== language) {
      continue;
    }

    const length = Array.from(item.text).length;

    if (
      batch.length >= MAX_BATCH_ITEMS ||
      totalCharacters + length >
        MAX_BATCH_CHARACTERS
    ) {
      continue;
    }

    batch.push(item);
    totalCharacters += length;
  }

  for (const item of batch) {
    pending.delete(getKey(item.text, item.language));
  }

  // Reserve the next request slot before
  // making the network request.
  nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;

  try {
    const response = await fetch(
      `${API_BASE_URL}/translate/public-batch`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: batch.map((item) => item.text),
          sourceLanguage: 'en',
          targetLanguage: language,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Translation API error: ${response.status}`
      );
    }

    const result = await response.json();

    const translations = result?.data?.translations;

    if (
      !result?.success ||
      !Array.isArray(translations) ||
      translations.length !== batch.length
    ) {
      throw new Error('Invalid translation response');
    }

    batch.forEach((item, index) => {
      const translated = translations[index];

      if (
        typeof translated === 'string' &&
        translated.trim()
      ) {
        publish(
          getKey(item.text, item.language),
          translated
        );
      }
    });
  } catch (error) {
    console.warn('Batch translation unavailable:', error);

    // Keep original text visible.
    // Failed requests are not automatically retried
    // to avoid exhausting the provider quota.
  } finally {
    processing = false;

    if (pending.size > 0) {
      scheduleProcessing(
        Math.max(100, nextRequestAt - Date.now())
      );
    }
  }
}

function requestTranslation(
  text: string,
  language: Language
) {
  if (
    language === 'en' ||
    !text.trim() ||
    Array.from(text).length > MAX_TEXT_LENGTH
  ) {
    return;
  }

  const key = getKey(text, language);

  if (
    translationCache.has(key) ||
    pending.has(key)
  ) {
    return;
  }

  pending.set(key, { text, language });
  scheduleProcessing();
}

export function useAutoTranslate(text: string): string {
  const { i18n } = useTranslation();

  const language = normalizeLanguage(
    i18n.resolvedLanguage ||
    i18n.language ||
    'en'
  );

  const key = getKey(text, language);

  const [translated, setTranslated] = useState(
    () => translationCache.get(key) ?? text
  );

  useEffect(() => {
    let active = true;

    if (language === 'en' || !text.trim()) {
      setTranslated(text);
      return;
    }

    const cached = translationCache.get(key);

    setTranslated(cached ?? text);

    const unsubscribe = subscribe(key, (value) => {
      if (active) {
        setTranslated(value);
      }
    });

    if (cached === undefined) {
      requestTranslation(text, language);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, [key, language, text]);

  // Avoid displaying a previous language's
  // translation during the first render after switching.
return language === 'en'
  ? text
  : translationCache.get(key) ?? text;
}
