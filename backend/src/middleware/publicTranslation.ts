import { Request, RequestHandler, Response } from 'express';
import {
  withTranslationDeadline,
  PUBLIC_TRANSLATION_TIMEOUT_MS,
} from '../services/translationDeadline';
// TRANSLATION_DEADLINE_V1
import {
  SUPPORTED_LANGUAGES,
  TranslationLanguage,
  translateTextOrOriginal,
} from '../services/translationService';

// Public content fields only. Do not translate identifiers, URLs,
// media paths, dates, contact information, prices or original verses.
const TRANSLATABLE_ROUTES: Record<string, readonly string[]> = {
  '/api/deities': ['name', 'description', 'significance', 'devotional'],
  '/api/activities': ['name', 'title', 'description', 'location'],
  '/api/activity-sections': ['name', 'title', 'description'],
  '/api/events': ['title', 'description', 'location', 'category_name'],
  '/api/event-categories': ['name', 'description'],
  '/api/gallery': ['name', 'title', 'description', 'caption', 'category'],
  '/api/guru-parampara': ['name', 'title', 'translation'],
  '/api/guru-vani': ['title', 'meaning', 'guru_name'],
  '/api/mahaswamiji-programmes': ['title', 'description', 'venue', 'location'],
  '/api/nearby': ['name', 'title', 'description', 'address', 'category_name'],
  '/api/poojas': ['name', 'title', 'description', 'significance'],
  '/api/pravachanas': ['title', 'description', 'speaker_name'],
  '/api/publications': ['name', 'title', 'description', 'author', 'category_name'],
  
  '/api/buildings': ['name', 'title', 'description'],
  '/api/welcome-screen': ['title', 'description'],
  '/api/welcome-slokams': ['title', 'description'],
  '/api/darshan-videos': ['title', 'description'],
  '/api/darshan/today': ['name'],
  '/api/temple-contact': [
    'description',
    'temple_name',
    'temple_address',
    'bangalore_address',
  ],
};

const MAX_FIELDS = 300;
const MAX_FIELD_LENGTH = 5000;
const CONCURRENCY = 5;
const routes = Object.entries(TRANSLATABLE_ROUTES)
  .sort(([a], [b]) => b.length - a.length);

function languageFromRequest(req: Request): TranslationLanguage {
  const raw = req.query.lang;
  if (typeof raw !== 'string') return 'en';
  const normalized = raw.trim().toLowerCase().split('-')[0] as TranslationLanguage;
  return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : 'en';
}

function fieldsForPath(path: string): Set<string> | null {
  const match = routes.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return match ? new Set(match[1]) : null;
}

function shouldTranslate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  return s.length > 0 && s.length <= MAX_FIELD_LENGTH &&
    !/^(?:https?:\/\/|data:|mailto:|tel:)/i.test(s) &&
    !/^\d+$/.test(s);
}

type Task = { parent: Record<string, unknown>; key: string; text: string };

function collectTasks(
  root: unknown,
  fields: Set<string>,
  maxFields: number
): { clone: unknown; tasks: Task[] } {
  const tasks: Task[] = [];
  const seen = new WeakMap<object, unknown>();

  function visit(value: unknown, depth: number): unknown {

    // Preserve dates and timestamps from PostgreSQL.
    if (value instanceof Date) {
      return value.toJSON();
    }

    // Preserve null values and primitive data types.
    if (
      value === null ||
      typeof value !== 'object' ||
      depth > 12
    ) {
      return value;
    }

    // Preserve special objects without recursive conversion.
    if (
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    ) {
      return value;
    }

    if (seen.has(value)) return seen.get(value);
    if (Array.isArray(value)) {
      const array: unknown[] = [];
      seen.set(value, array);
      for (const item of value) array.push(visit(item, depth + 1));
      return array;
    }
    const output: Record<string, unknown> = {};
    seen.set(value, output);
    for (const [key, item] of Object.entries(value)) {
      if (fields.has(key) && shouldTranslate(item) && tasks.length < maxFields) {
        output[key] = item;
        tasks.push({ parent: output, key, text: item });
      } else {
        output[key] = visit(item, depth + 1);
      }
    }
    return output;
  }

  return { clone: visit(root, 0), tasks };
}
async function translateResponse(
  body: unknown,
  language: TranslationLanguage,
  fields: Set<string>
) {
  const { clone, tasks } = collectTasks(
    body,
    fields,
    MAX_FIELDS
  );

  if (!tasks.length) {
    return clone;
  }

  // Prioritize visible names, titles and categories.
  const priorityFields = new Set([
    'name',
    'title',
    'category',
    'category_name',
    'temple_name',
    'guru_name',
    'speaker_name',
    'author',
  ]);

  const orderedTasks = [...tasks].sort(
    (a, b) =>
      Number(priorityFields.has(b.key)) -
      Number(priorityFields.has(a.key))
  );

  const uniqueTexts = [
    ...new Set(
      orderedTasks.map(task => task.text)
    ),
  ];

  const translated = new Map<string, string>();

  const deadline =
    Date.now() + PUBLIC_TRANSLATION_TIMEOUT_MS;

  let cursor = 0;
  let stopped = false;

  async function worker() {
    while (
      !stopped &&
      cursor < uniqueTexts.length &&
      Date.now() < deadline
    ) {
      const original = uniqueTexts[cursor++];

      try {
        const result =
          await translateTextOrOriginal(
            original,
            language,
            'en'
          );

        if (
          !stopped &&
          Date.now() < deadline
        ) {
          translated.set(original, result);
        }
      } catch (error) {
        console.warn(
          'Public content translation failed:',
          error
        );
      }
    }
  }

  try {
    await withTranslationDeadline(
      Promise.all(
        Array.from(
          {
            length: Math.min(
              CONCURRENCY,
              uniqueTexts.length
            ),
          },
          worker
        )
      ).then(() => undefined),
      undefined
    );
  } finally {
    stopped = true;
  }

  // Preserve completed translations.
  // Only unfinished fields retain their original text.
  for (const task of tasks) {
    task.parent[task.key] =
      translated.get(task.text) ?? task.text;
  }

  return clone;
}

export const publicTranslationMiddleware: RequestHandler = (req, res, next) => {
  if (req.method !== 'GET') return next();
  const path = req.path;
  // PUBLIC_TRANSLATION_V3
  // Never translate nested administrative endpoints.
  if (path.toLowerCase().split('/').includes('admin')) {
    return next();
  }
  if (
    ['/api/admin', '/api/auth', '/api/dharma', '/api/notifications', '/api/translate', '/api/announcements']
      .some(prefix => path === prefix || path.startsWith(`${prefix}/`))
  ) return next();

  const language = languageFromRequest(req);
  if (language === 'en') return next();
  const fields = fieldsForPath(path);
  if (!fields) return next();

  const originalJson = res.json.bind(res);
  let sent = false;
  res.json = ((body: unknown) => {
    if (sent || res.headersSent || res.statusCode < 200 || res.statusCode >= 300) {
      return originalJson(body);
    }
    sent = true;
    void (async () => {
      try {
       const translated = await translateResponse(
  body,
  language,
  fields
);
        if (!res.headersSent && !res.writableEnded) originalJson(translated);
      } catch (error) {
        console.error('Public translation middleware error:', error);
        if (!res.headersSent && !res.writableEnded) originalJson(body);
      }
    })();
    return res;
  }) as typeof res.json;
  next();
};
