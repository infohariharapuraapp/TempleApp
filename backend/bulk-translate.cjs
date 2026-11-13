
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const LANGUAGES = ['te', 'kn', 'hi', 'ta'];

// Only administrator-managed, displayable text.
// Original verses, personal information and URLs are excluded.
const TABLES = {
  activities: [
    'title',
    'description',
    'location',
  ],
  activity_sections: [
    'name',
    'description',
  ],
  announcements: [
    'title',
    'message',
  ],
  buildings: [
    'name',
    'description',
  ],
  darshan_slots: [
    'name',
    'description',
  ],
  darshan_videos: [
    'title',
    'description',
    'label',
  ],
  deities: [
    'name',
    'description',
    'significance',
    'devotional',
  ],
  dharma_categories: [
    'name',
    'description',
  ],
  event_categories: [
    'name',
  ],
  events: [
    'title',
    'description',
    'location',
  ],
  gallery: [
    'title',
    'description',
  ],
  gallery_albums: [
    'name',
    'description',
  ],
  guru_parampara: [
    'name',
    'title',
    'translation',
  ],
  guru_vani: [
    'title',
    'meaning',
    'guru_name',
  ],
  mahaswamiji_programmes: [
    'title',
    'description',
    'venue',
  ],
  nearby_place_categories: [
    'name',
    'description',
  ],
  nearby_places: [
    'name',
    'description',
    'address',
  ],
  notifications: [
    'title',
    'body',
  ],
  pooja_sections: [
    'name',
  ],
  poojas: [
    'name',
    'description',
  ],
  pravachana_videos: [
    'title',
    'description',
  ],
  publication_categories: [
    'name',
    'description',
  ],
  publications: [
    'title',
    'description',
    'author',
  ],
  quotes: [
    'title',
    'quote_text',
    'author',
  ],
  room_types: [
    'name',
    'description',
  ],
  rooms: [
    'description',
  ],
  seva_categories: [
    'name',
    'description',
  ],
  sevas: [
    'name',
    'description',
  ],
  today_darshan_videos: [
    'name',
  ],
  welcome_screen_settings: [
    'title',
  ],
  welcome_slokams: [
    'title',
  ],
};

// Existing records marked as another language
// should not be treated as English.
const LANGUAGE_COLUMN_TABLES = new Set([
  'quotes',
  'pravachana_videos',
]);

function loadTranslationService() {
  const candidates = [
    './dist/services/translationService.js',
    './dist/src/services/translationService.js',
  ];

  for (const candidate of candidates) {
    const fullPath = path.resolve(
      __dirname,
      candidate
    );

    if (fs.existsSync(fullPath)) {
      return require(fullPath);
    }
  }

  throw new Error(
    'Compiled translationService.js not found. Run npm run build first.'
  );
}

function isQuotaError(error) {
  return (
    error?.statusCode === 429 ||
    /quota|daily limit|allowance|too many requests/i.test(
      String(error?.message || '')
    )
  );
}

async function main() {
  const { translateText } =
    loadTranslationService();

  let translated = 0;
  let failed = 0;
  let processed = 0;

  console.log('Starting bulk translation...');
  console.log('Languages:', LANGUAGES.join(', '));

  try {
    for (const [table, fields] of Object.entries(TABLES)) {
      console.log(`\nProcessing: ${table}`);

      const selectedColumns = [
        'id',
        ...fields,
      ];

      if (LANGUAGE_COLUMN_TABLES.has(table)) {
        selectedColumns.push('language');
      }

      const query = `
        SELECT ${selectedColumns
          .map((column) => `"${column}"`)
          .join(', ')}
        FROM "${table}"
        ORDER BY id
      `;

      const result = await pool.query(query);

      for (const row of result.rows) {
        if (
          LANGUAGE_COLUMN_TABLES.has(table) &&
          row.language &&
          !['en', 'english'].includes(
            String(row.language)
              .trim()
              .toLowerCase()
          )
        ) {
          continue;
        }

        for (const field of fields) {
          const value = row[field];

          if (
            typeof value !== 'string' ||
            !value.trim()
          ) {
            continue;
          }

          // Avoid accidentally translating
          // media URLs stored in text columns.
          if (/^https?:\/\//i.test(value.trim())) {
            continue;
          }

          for (const language of LANGUAGES) {
            try {
              await translateText(
                value,
                language,
                'en'
              );

              processed++;
              translated++;

              console.log(
                `OK ${table} #${row.id} ` +
                `${field} -> ${language}`
              );
            } catch (error) {
              if (isQuotaError(error)) {
                console.log(
                  '\nDaily translation quota reached.'
                );
                console.log(
                  'Existing cached translations are safe.'
                );
                console.log(
                  'Run this command again after quota resets.'
                );
                return;
              }

              failed++;

              console.error(
                `FAILED ${table} #${row.id} ` +
                `${field} -> ${language}:`,
                error.message
              );
            }
          }
        }
      }
    }
  } finally {
    console.log('\nBulk translation summary:');
    console.log('Successful requests:', translated);
    console.log('Failed requests:', failed);
    console.log('Processed:', processed);

    await pool.end();
  }
}

main().catch(async (error) => {
  console.error(
    'Bulk translation failed:',
    error.message
  );

  await pool.end();
  process.exitCode = 1;
});
