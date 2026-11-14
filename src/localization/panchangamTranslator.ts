import i18n from '@/localization/i18n';

// ========================================
// TYPES
// ========================================

export type PanchangamField =
  | 'tithi'
  | 'nakshatra'
  | 'yoga'
  | 'karana'
  | 'vara'
  | 'masa'
  | 'samvatsara'
  | 'paksha'
  | 'ayana'
  | 'ritu'
  | 'solarRashi';

export interface PanchangamObservance {
  name: string;
  type: string;
  description: string;
}

// ========================================
// LANGUAGE
// ========================================

function getLanguage(): string {
  return (
    i18n.resolvedLanguage ||
    i18n.language ||
    'en'
  ).split('-')[0];
}

function makeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// ========================================
// DICTIONARY LOOKUP
// ========================================

export function translateTerm(
  value: string,
  prefix = '',
): string {
  if (!value || getLanguage() === 'en') {
    return value;
  }

  return i18n.t(
    `panchangamTerms.${prefix}${makeKey(value)}`,
    {
      defaultValue: value,
    },
  );
}

export function translatePanchangamLabel(
  value: string,
): string {
  return i18n.t(
    `dailyPanchangam.${makeKey(value)}`,
    {
      defaultValue: value,
    },
  );
}

// ========================================
// TIME TRANSLATION
// ========================================

export function translatePanchangamTime(
  value?: string | null,
): string {
  if (!value) return '--:--';

  if (getLanguage() === 'en') {
    return value;
  }

  return value.replace(
    /\b(am|pm)\b/gi,
    match => translateTerm(match.toUpperCase()),
  );
}

// ========================================
// TITHI TRANSLATION
// ========================================

function translateTithi(value: string): string {
  const match =
    /^(Shukla|Krishna)\s+(.+)$/.exec(value);

  if (!match) {
    return translateTerm(value);
  }

  return [
    translateTerm(match[1]),
    translateTerm(match[2]),
  ].join(' ');
}

// ========================================
// MASA TRANSLATION
// ========================================

function translateMasa(value: string): string {
  const match =
    /^(Adhika\s+)?(.+?)\s*\(Amanta(?:;\s*Kshaya boundary)?\)$/
      .exec(value);

  if (!match) {
    return translateTerm(value);
  }

  const month = match[2];

  const specialMonths = [
    'Jyeshtha',
    'Shravana',
    'Magha',
  ];

  const translatedMonth = translateTerm(
    month,
    specialMonths.includes(month)
      ? 'month_'
      : '',
  );

  const adhika = match[1]
    ? translateTerm('Adhika') + ' '
    : '';

  const amanta = translateTerm('Amanta');

  const kshaya = value.includes('Kshaya boundary')
    ? '; ' + translateTerm('Kshaya boundary')
    : '';

  return (
    `${adhika}${translatedMonth} ` +
    `(${amanta}${kshaya})`
  );
}

// ========================================
// SAMVATSARA TRANSLATION
// ========================================

function translateSamvatsara(
  value: string,
): string {
  const name = value.replace(
    /\s+Samvatsara$/,
    '',
  );

  return (
    translateTerm(name) +
    ' ' +
    translateTerm('Samvatsara')
  );
}

// ========================================
// TRANSITION TIME
// ========================================

function translateEndingTime(
  value: string,
): string {
  const match =
    /^(.*?)\s*(\(\d{4}-\d{2}-\d{2}\))?$/
      .exec(value.trim());

  const time = translatePanchangamTime(
    match?.[1] || value,
  );

  const date = match?.[2]
    ? ` ${match[2]}`
    : '';

  return (
    `${time} ${translateTerm('Until')}${date}`
  );
}

// ========================================
// MAIN DYNAMIC VALUE TRANSLATOR
// ========================================

export function translatePanchangamValue(
  value?: string | null,
  field?: PanchangamField,
): string {
  if (!value || !value.trim()) {
    return translatePanchangamLabel(
      'Not available',
    );
  }

  if (getLanguage() === 'en') {
    return value;
  }

  const parts = value.split(/\s*•\s*Until\s+/i);

  const name = parts[0].trim();

  let translated: string;

  switch (field) {
    case 'tithi':
      translated = translateTithi(name);
      break;

    case 'masa':
      translated = translateMasa(name);
      break;

    case 'samvatsara':
      translated = translateSamvatsara(name);
      break;

    default:
      translated = translateTerm(name);
      break;
  }

  if (parts.length > 1) {
    translated +=
      ' • ' + translateEndingTime(parts[1]);
  }

  return translated;
}

// ========================================
// LOCATION TRANSLATION
// ========================================

export function translatePanchangamLocation(
  value: string,
): string {
  return value
    .split(',')
    .map(part => translateTerm(part.trim()))
    .join(', ');
}

// ========================================
// OBSERVANCE NAME TRANSLATION
// ========================================

export function translateObservanceName(
  value: string,
): string {
  if (!value || getLanguage() === 'en') {
    return value;
  }

  const rules: Array<[RegExp, string]> = [
    [
      /^Smarta (.+) review$/,
      'smarta_review',
    ],
    [
      /^Madhwa\/Vaishnava (.+) review$/,
      'madhwa_review',
    ],
    [
      /^(.+) Dashami Vedha review$/,
      'dashami_vedha_review',
    ],
    [
      /^(.+) dawn-boundary review$/,
      'dawn_boundary_review',
    ],
    [
      /^(.+) begins today$/,
      'begins_today',
    ],
    [
      /^(.+?) (?:Tithi )?skipped at sunrise$/,
      'skipped_at_sunrise',
    ],
    [
      /^(.+) repeated Tithi$/,
      'repeated_tithi',
    ],
  ];

  for (const [pattern, key] of rules) {
    const match = pattern.exec(value);

    if (match) {
      return i18n.t(
        `panchangamObservances.${key}`,
        {
          name: translateTithi(match[1]),
          defaultValue: value,
        },
      );
    }
  }

  return translateTithi(value);
}

// ========================================
// OBSERVANCE DESCRIPTION TRANSLATION
// ========================================

export function translateObservanceDescription(
  value: string,
): string {
  if (!value || getLanguage() === 'en') {
    return value;
  }

  const rules: Array<[string, string]> = [
    [
      'Ekadashi Tithi is present at sunrise.',
      'ekadashi_at_sunrise',
    ],
    [
      'Ekadashi is present at sunrise.',
      'smarta_validation',
    ],
    [
      'Ekadashi is present at both',
      'arunodaya_validation',
    ],
    [
      'Dashami is present at the',
      'dashami_vedha_validation',
    ],
    [
      'The Arunodaya and sunrise Tithis differ.',
      'dawn_boundary_validation',
    ],
    [
      'Ekadashi begins after sunrise',
      'ekadashi_begins_validation',
    ],
    [
      'Ekadashi occurs between consecutive',
      'ekadashi_skipped_validation',
    ],
    [
      'Ekadashi is present at consecutive',
      'repeated_ekadashi_validation',
    ],
    [
      'Dwadashi occurs before the next',
      'dwadashi_skipped_validation',
    ],
    [
      'Trayodashi overlaps',
      'pradosha_validation',
    ],
    [
      'Purnima Tithi is present at sunrise.',
      'purnima_validation',
    ],
    [
      'Amavasya Tithi is present at sunrise.',
      'amavasya_validation',
    ],
    [
      'The Tithi occurs between consecutive',
      'skipped_tithi_validation',
    ],
    [
      'Preliminary Ekadashi assessment only.',
      'ekadashi_assessment_note',
    ],
    [
      'Dynamic astronomical calculations use',
      'calculation_note',
    ],
  ];

  for (const [prefix, key] of rules) {
    if (value.startsWith(prefix)) {
      return i18n.t(
        `panchangamObservances.${key}`,
        {
          defaultValue: value,
        },
      );
    }
  }

  // Preserve unknown messages instead of
  // hiding or incorrectly translating warnings.

  return value;
}

// ========================================
// COMPLETE OBSERVANCE TRANSLATION
// ========================================

export function translatePanchangamObservance(
  item: PanchangamObservance,
): PanchangamObservance {
  return {
    ...item,
    name: translateObservanceName(item.name),
    description:
      translateObservanceDescription(
        item.description,
      ),
  };
}