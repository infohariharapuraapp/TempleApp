
import { createHash } from 'crypto';
import { pool } from '../db';

export type TranslationLanguage =
  | 'en'
  | 'te'
  | 'kn'
  | 'hi'
  | 'ta';

export const SUPPORTED_LANGUAGES: TranslationLanguage[] = [
  'en',
  'te',
  'kn',
  'hi',
  'ta',
];

const PROVIDER = 'mymemory';
const MAX_REQUEST_BYTES = 450;
const REQUEST_TIMEOUT_MS = 15000;

// Conservative default below the anonymous MyMemory allowance.
// Counts attempted source characters, including failed requests.
// The provider's own accounting remains authoritative.
const DEFAULT_DAILY_LIMIT = 4000;

export class TranslationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 503
  ) {
    super(message);
    this.name = 'TranslationError';
  }
}

function isSupportedLanguage(
  value: unknown
): value is TranslationLanguage {
  return (
    typeof value === 'string' &&
    SUPPORTED_LANGUAGES.includes(
      value as TranslationLanguage
    )
  );
}

function sourceHash(text: string): string {
  return createHash('sha256')
    .update(text, 'utf8')
    .digest('hex');
}

function dailyLimit(): number {
  const configured = Number(
    process.env.TRANSLATION_DAILY_LIMIT
  );

  if (
    Number.isSafeInteger(configured) &&
    configured > 0
  ) {
    return Math.min(configured, 4000);
  }

  return DEFAULT_DAILY_LIMIT;
}

// Split at sentence/word boundaries where possible.
// Keep each request safely below MyMemory's byte limit.
function splitText(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (
      Buffer.byteLength(remaining, 'utf8') <=
      MAX_REQUEST_BYTES
    ) {
      chunks.push(remaining);
      break;
    }

    let candidate = '';
    let lastBoundary = -1;

    for (const character of remaining) {
      const next = candidate + character;

      if (
        Buffer.byteLength(next, 'utf8') >
        MAX_REQUEST_BYTES
      ) {
        break;
      }

      candidate = next;

      if (/[.!?।\n,;:\s]/u.test(character)) {
        lastBoundary = candidate.length;
      }
    }

    if (!candidate) {
      throw new TranslationError(
        'Unable to split translation text.'
      );
    }

    const cut =
      lastBoundary > candidate.length / 3
        ? lastBoundary
        : candidate.length;

    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }

  return chunks;
}

// Reserve usage atomically in PostgreSQL.
// Concurrent Render requests cannot exceed our configured limit.
async function reserveQuota(
  characters: number
): Promise<void> {
  const limit = dailyLimit();

  if (characters > limit) {
    throw new TranslationError(
      'Translation exceeds the daily character allowance.',
      429
    );
  }

  const result = await pool.query(
    `
    INSERT INTO translation_daily_usage (
      usage_date,
      used_characters,
      updated_at
    )
    VALUES (
      (NOW() AT TIME ZONE 'UTC')::date,
      $1,
      NOW()
    )
    ON CONFLICT (usage_date)
    DO UPDATE SET
      used_characters =
        translation_daily_usage.used_characters +
        EXCLUDED.used_characters,
      updated_at = NOW()
    WHERE
      translation_daily_usage.used_characters +
      EXCLUDED.used_characters <= $2
    RETURNING used_characters
    `,
    [characters, limit]
  );

  if (result.rowCount === 0) {
    throw new TranslationError(
      'Daily translation limit reached. Try again tomorrow.',
      429
    );
  }
}

async function translateChunk(
  text: string,
  sourceLanguage: TranslationLanguage,
  targetLanguage: TranslationLanguage
): Promise<string> {
  // Reserve BEFORE calling the external provider.
  await reserveQuota(Array.from(text).length);

  const url = new URL(
    'https://api.mymemory.translated.net/get'
  );

  url.searchParams.set('q', text);
  url.searchParams.set(
    'langpair',
    `${sourceLanguage}|${targetLanguage}`
  );

  const email = process.env.MYMEMORY_EMAIL?.trim();

  if (email) {
    url.searchParams.set('de', email);
  }

  let response: globalThis.Response;

  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(
        REQUEST_TIMEOUT_MS
      ),
    });
  } catch {
    throw new TranslationError(
      'Translation provider is temporarily unreachable.'
    );
  }

  if (!response.ok) {
    throw new TranslationError(
      `Translation provider HTTP error: ${response.status}`
    );
  }

  let data: any;

  try {
    data = await response.json();
  } catch {
    throw new TranslationError(
      'Invalid response from translation provider.'
    );
  }

  if (Number(data?.responseStatus) !== 200) {
    throw new TranslationError(
      typeof data?.responseDetails === 'string'
        ? data.responseDetails
        : 'Translation provider rejected the request.'
    );
  }

  const translated = data?.responseData?.translatedText;

  if (
    typeof translated !== 'string' ||
    !translated.trim()
  ) {
    throw new TranslationError(
      'Translation provider returned empty text.'
    );
  }

  return translated;
}

export async function translateText(
  text: string,
  targetLanguage: TranslationLanguage,
  sourceLanguage: TranslationLanguage = 'en'
): Promise<string> {
  if (typeof text !== 'string') {
    throw new TranslationError(
      'Translation text must be a string.',
      400
    );
  }

  if (!text.trim()) {
    return text;
  }

  if (
    !isSupportedLanguage(sourceLanguage) ||
    !isSupportedLanguage(targetLanguage)
  ) {
    throw new TranslationError(
      'Unsupported translation language.',
      400
    );
  }

  if (sourceLanguage === targetLanguage) {
    return text;
  }

  const hash = sourceHash(text);

  // Check cache first.
  const cached = await pool.query(
    `
    SELECT source_text, translated_text
    FROM translation_cache
    WHERE source_language = $1
      AND target_language = $2
      AND source_hash = $3
    LIMIT 1
    `,
    [sourceLanguage, targetLanguage, hash]
  );

  if (
    cached.rows.length > 0 &&
    cached.rows[0].source_text === text
  ) {
    return cached.rows[0].translated_text;
  }

  const chunks = splitText(text);
  const translatedChunks: string[] = [];

  // Translate sequentially to avoid bursts.
  for (const chunk of chunks) {
    translatedChunks.push(
      await translateChunk(
        chunk,
        sourceLanguage,
        targetLanguage
      )
    );
  }

  const translatedText = translatedChunks.join('');

  // Save only after every chunk succeeds.
  await pool.query(
    `
    INSERT INTO translation_cache (
      source_language,
      target_language,
      source_hash,
      source_text,
      translated_text,
      provider
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (
      source_language,
      target_language,
      source_hash
    )
    DO UPDATE SET
      translated_text = EXCLUDED.translated_text,
      provider = EXCLUDED.provider,
      updated_at = NOW()
    `,
    [
      sourceLanguage,
      targetLanguage,
      hash,
      text,
      translatedText,
      PROVIDER,
    ]
  );

  return translatedText;
}

export async function translateToAllLanguages(
  text: string,
  sourceLanguage: TranslationLanguage = 'en'
): Promise<Record<TranslationLanguage, string>> {
  const result = {} as Record<
    TranslationLanguage,
    string
  >;

  for (const language of SUPPORTED_LANGUAGES) {
    result[language] =
      language === sourceLanguage
        ? text
        : await translateText(
            text,
            language,
            sourceLanguage
          );
  }

  return result;
}

// Safe fallback for displaying existing public content.
// Use strict translateText() when generating or saving translations.
export async function translateTextOrOriginal(
  text: string,
  targetLanguage: TranslationLanguage,
  sourceLanguage: TranslationLanguage = 'en'
): Promise<string> {
  try {
    return await translateText(
      text,
      targetLanguage,
      sourceLanguage
    );
  } catch (error) {
    console.error(
      'Translation unavailable:',
      error
    );

    return text;
  }
}
