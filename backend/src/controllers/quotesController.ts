
import { Request, Response } from 'express';
import { pool } from '../db';
import {
  SUPPORTED_LANGUAGES,
  TranslationLanguage,
  translateTextOrOriginal,
} from '../services/translationService';

import {
  withTranslationDeadline,
} from '../services/translationDeadline';

type QuoteInput = {
  title?: unknown;
  quote_text?: unknown;
  author?: unknown;
  language?: unknown;
  is_published?: unknown;
};

function validId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function optionalText(
  value: unknown,
  field: string,
  maxLength: number
): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`${field} must be text.`);
  }

  const text = value.trim();

  if (text.length > maxLength) {
    throw new Error(
      `${field} cannot exceed ${maxLength} characters.`
    );
  }

  return text || null;
}

function requiredText(
  value: unknown,
  field: string,
  maxLength: number
): string {
  const text = optionalText(value, field, maxLength);

  if (!text) {
    throw new Error(`${field} is required.`);
  }

  return text;
}

function validateBody(
  body: QuoteInput,
  creating: boolean
) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Invalid request body.');
  }

  const allowed = [
    'title',
    'quote_text',
    'author',
    'language',
    'is_published',
  ];

  const keys = Object.keys(body);

  if (!creating && keys.length === 0) {
    throw new Error('No fields provided to update.');
  }

  for (const key of keys) {
    if (!allowed.includes(key)) {
      throw new Error(`Unknown field: ${key}`);
    }
  }

  if (
    body.is_published !== undefined &&
    typeof body.is_published !== 'boolean'
  ) {
    throw new Error('is_published must be true or false.');
  }

  return {
    title:
      body.title !== undefined
        ? optionalText(body.title, 'Title', 255)
        : undefined,

    quote_text:
      creating || body.quote_text !== undefined
        ? requiredText(body.quote_text, 'Quote text', 5000)
        : undefined,

    author:
      body.author !== undefined
        ? optionalText(body.author, 'Author', 255)
        : undefined,

    language:
      body.language !== undefined
        ? requiredText(body.language, 'Language', 50)
        : creating
          ? 'Kannada'
          : undefined,

    is_published:
      body.is_published !== undefined
        ? body.is_published
        : creating
          ? false
          : undefined,
  };
}
function normalizeQuoteLanguage(
  value: unknown
): TranslationLanguage | null {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();

  const aliases: Record<string, string> = {
    english: 'en',
    telugu: 'te',
    kannada: 'kn',
    hindi: 'hi',
    tamil: 'ta',
    'తెలుగు': 'te',
    'ಕನ್ನಡ': 'kn',
    'हिन्दी': 'hi',
    'हिंदी': 'hi',
    'தமிழ்': 'ta',
  };

  const code = aliases[raw] || raw.split('-')[0];

  return SUPPORTED_LANGUAGES.includes(
    code as TranslationLanguage
  )
    ? (code as TranslationLanguage)
    : null;
}
function detectQuoteLanguage(
  text: string,
  fallback: TranslationLanguage | null
): TranslationLanguage | null {
  const scores: Record<TranslationLanguage, number> = {
    en: (text.match(/[a-zA-Z]/g) || []).length,
    te: (text.match(/[\u0C00-\u0C7F]/g) || []).length,
    kn: (text.match(/[\u0C80-\u0CFF]/g) || []).length,
    hi: (text.match(/[\u0900-\u097F]/g) || []).length,
    ta: (text.match(/[\u0B80-\u0BFF]/g) || []).length,
  };

  const ranked = (
    Object.entries(scores) as [
      TranslationLanguage,
      number
    ][]
  ).sort((a, b) => b[1] - a[1]);

  if (
    ranked[0][1] === 0 ||
    ranked[0][1] === ranked[1][1]
  ) {
    return fallback;
  }

  return ranked[0][0];
}
// PUBLIC: Published quotes only, latest first
// PUBLIC: Published quotes with dynamic translation
// PUBLIC: Published quotes with automatic translation
export async function getQuotes(
  req: Request,
  res: Response
) {
  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        quote_text,
        author,
        language,
        published_at,
        created_at
      FROM quotes
      WHERE is_published = TRUE
      ORDER BY published_at DESC NULLS LAST, id DESC
    `);

    const targetLanguage =
      normalizeQuoteLanguage(req.query.lang) || 'en';

    const rows = result.rows.map(row => ({ ...row }));

    const TIMEOUT_MS = 10000;

    let cursor = 0;
    let finished = false;

    const deadline = Date.now() + TIMEOUT_MS;

    async function worker() {
      while (
        cursor < rows.length &&
        Date.now() < deadline &&
        !finished
      ) {
        const index = cursor++;
        const row = rows[index];

        const storedLanguage =
          normalizeQuoteLanguage(row.language);

        const fields = [
          'quote_text',
          'title',
        ] as const;

        for (const field of fields) {
          if (
            finished ||
            Date.now() >= deadline
          ) {
            break;
          }

          const original = row[field];

          if (
            typeof original !== 'string' ||
            !original.trim()
          ) {
            continue;
          }

          const sourceLanguage =
            detectQuoteLanguage(
              original,
              storedLanguage
            );

          if (
            !sourceLanguage ||
            sourceLanguage === targetLanguage
          ) {
            continue;
          }

          const translated =
            await translateTextOrOriginal(
              original,
              targetLanguage,
              sourceLanguage
            );

          if (
            !finished &&
            Date.now() < deadline
          ) {
            row[field] = translated;
          }
        }
      }
    }

    await withTranslationDeadline(
      Promise.all(
        Array.from(
          {
            length: Math.min(
              3,
              rows.length
            ),
          },
          () => worker()
        )
      ).then(() => undefined),
      undefined,
      TIMEOUT_MS
    );

    finished = true;

    return res.json({
      success: true,
      data: rows.map(row => ({ ...row })),
    });

  } catch (error) {
    console.error(
      'Get quotes error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to load quotes.',
    });
  }
}

// ADMIN: All quotes including drafts
export async function getAdminQuotes(
  _req: Request,
  res: Response
) {
  try {
    const result = await pool.query(`
      SELECT *
      FROM quotes
      ORDER BY
        COALESCE(published_at, created_at) DESC,
        id DESC
    `);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get admin quotes error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load admin quotes.',
    });
  }
}

// ADMIN: Create a quote
export async function createQuote(
  req: Request,
  res: Response
) {
  let input: ReturnType<typeof validateBody>;

  try {
    input = validateBody(req.body, true);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Invalid quote data.',
    });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO quotes (
        title,
        quote_text,
        author,
        language,
        is_published,
        published_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        CASE WHEN $5::boolean THEN NOW() ELSE NULL END
      )
      RETURNING *
      `,
      [
        input.title ?? null,
        input.quote_text,
        input.author ?? null,
        input.language,
        input.is_published,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Quote created successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create quote error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create quote.',
    });
  }
}

// ADMIN: Edit or publish/unpublish
export async function updateQuote(
  req: Request,
  res: Response
) {
  const id = validId(String(req.params.id));

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Invalid quote ID.',
    });
  }

  let input: ReturnType<typeof validateBody>;

  try {
    input = validateBody(req.body, false);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Invalid quote data.',
    });
  }

  try {
    const result = await pool.query(
      `
      UPDATE quotes
      SET
        title = CASE
          WHEN $2::boolean THEN $3 ELSE title
        END,
        quote_text = CASE
          WHEN $4::boolean THEN $5 ELSE quote_text
        END,
        author = CASE
          WHEN $6::boolean THEN $7 ELSE author
        END,
        language = CASE
          WHEN $8::boolean THEN $9 ELSE language
        END,
        published_at = CASE
          WHEN $10::boolean = FALSE THEN NULL
          WHEN $10::boolean = TRUE
               AND is_published = FALSE THEN NOW()
          ELSE published_at
        END,
        is_published = COALESCE(
          $10::boolean,
          is_published
        ),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        input.title !== undefined,
        input.title ?? null,
        input.quote_text !== undefined,
        input.quote_text ?? null,
        input.author !== undefined,
        input.author ?? null,
        input.language !== undefined,
        input.language ?? null,
        input.is_published ?? null,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found.',
      });
    }

    return res.json({
      success: true,
      message: 'Quote updated successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update quote error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update quote.',
    });
  }
}

// ADMIN: Permanently delete
export async function deleteQuote(
  req: Request,
  res: Response
) {
  const id = validId(String(req.params.id));

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Invalid quote ID.',
    });
  }

  try {
    const result = await pool.query(
      'DELETE FROM quotes WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found.',
      });
    }

    return res.json({
      success: true,
      message: 'Quote deleted successfully.',
    });
  } catch (error) {
    console.error('Delete quote error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete quote.',
    });
  }
}
