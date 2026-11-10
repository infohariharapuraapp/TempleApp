
import {
  Body,
  Observer,
  SearchRiseSet,
} from 'astronomy-engine';
import { assessEkadashi } from './ekadashiService';
import { linkParanaToEkadashi } from './paranaLinkService';
import {
  calculateObservances,
} from './observanceService';
import {
  calculateParanaCandidate,
} from './paranaService';

import * as swe from 'sweph';

const IST_OFFSET = 330 * 60000;
const DAY_MS = 86400000;
const HOUR_MS = 3600000;

const SUN = 0;
const MOON = 1;
const LAHIRI = 1;
const GREGORIAN = 1;
const MOSEPH = 4;
const SIDEREAL = 65536;
const FLAGS = MOSEPH | SIDEREAL;

const WEEKDAYS = [
  'Ravivara (Sunday)',
  'Somavara (Monday)',
  'Mangalavara (Tuesday)',
  'Budhavara (Wednesday)',
  'Guruvara (Thursday)',
  'Shukravara (Friday)',
  'Shanivara (Saturday)',
];

const RAHU = [7, 1, 6, 4, 5, 3, 2];
const YAMAGANDA = [4, 3, 2, 1, 0, 6, 5];
const GULIKA = [6, 5, 4, 3, 2, 1, 0];

const TITHIS = [
  'Pratipada', 'Dwitiya', 'Tritiya',
  'Chaturthi', 'Panchami', 'Shashthi',
  'Saptami', 'Ashtami', 'Navami',
  'Dashami', 'Ekadashi', 'Dwadashi',
  'Trayodashi', 'Chaturdashi', 'Purnima',
];

const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika',
  'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha',
  'Magha', 'Purva Phalguni',
  'Uttara Phalguni', 'Hasta', 'Chitra',
  'Swati', 'Vishakha', 'Anuradha',
  'Jyeshtha', 'Mula', 'Purva Ashadha',
  'Uttara Ashadha', 'Shravana',
  'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada',
  'Uttara Bhadrapada', 'Revati',
];

const YOGAS = [
  'Vishkambha', 'Priti', 'Ayushman',
  'Saubhagya', 'Shobhana', 'Atiganda',
  'Sukarma', 'Dhriti', 'Shula',
  'Ganda', 'Vriddhi', 'Dhruva',
  'Vyaghata', 'Harshana', 'Vajra',
  'Siddhi', 'Vyatipata', 'Variyana',
  'Parigha', 'Shiva', 'Siddha',
  'Sadhya', 'Shubha', 'Shukla',
  'Brahma', 'Indra', 'Vaidhriti',
];

const KARANAS = [
  'Bava', 'Balava', 'Kaulava',
  'Taitila', 'Garaja', 'Vanija',
  'Vishti (Bhadra)',
];

const MONTHS = [
  'Chaitra', 'Vaishakha', 'Jyeshtha',
  'Ashadha', 'Shravana', 'Bhadrapada',
  'Ashwayuja', 'Kartika', 'Margashira',
  'Pausha', 'Magha', 'Phalguna',
];

const RASHIS = [
  'Mesha', 'Vrishabha', 'Mithuna',
  'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu',
  'Makara', 'Kumbha', 'Meena',
];

const SAMVATSARAS = [
  'Prabhava', 'Vibhava', 'Shukla',
  'Pramoduta', 'Prajotpatti', 'Angirasa',
  'Shrimukha', 'Bhava', 'Yuva',
  'Dhatri', 'Ishvara', 'Bahudhanya',
  'Pramathi', 'Vikrama', 'Vrisha',
  'Chitrabhanu', 'Svabhanu', 'Tarana',
  'Parthiva', 'Vyaya', 'Sarvajit',
  'Sarvadhari', 'Virodhi', 'Vikriti',
  'Khara', 'Nandana', 'Vijaya',
  'Jaya', 'Manmatha', 'Durmukhi',
  'Hevilambi', 'Vilambi', 'Vikari',
  'Sharvari', 'Plava', 'Shubhakrit',
  'Shobhakrit', 'Krodhi', 'Vishvavasu',
  'Parabhava', 'Plavanga', 'Kilaka',
  'Saumya', 'Sadharana', 'Virodhikrit',
  'Paridhavi', 'Pramadi', 'Ananda',
  'Rakshasa', 'Nala', 'Pingala',
  'Kalayukti', 'Siddharthi', 'Raudra',
  'Durmati', 'Dundubhi', 'Rudhirodgari',
  'Raktakshi', 'Krodhana', 'Akshaya',
];

const ugadiCache = new Map<string, string>();

swe.set_sid_mode(LAHIRI, 0, 0);

function norm(n: number): number {
  return ((n % 360) + 360) % 360;
}

function istDate(ms: number): string {
  return new Date(ms + IST_OFFSET)
    .toISOString().slice(0, 10);
}

function istStart(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`)
    - IST_OFFSET;
}

function addDate(
  date: string,
  days: number,
): string {
  return istDate(istStart(date) + days * DAY_MS);
}

function formatIST(ms: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(ms));
}

function range(a: number, b: number): string {
  return `${formatIST(a)} - ${formatIST(b)}`;
}

function segment(
  sunrise: number,
  sunset: number,
  index: number,
): string {
  const length = (sunset - sunrise) / 8;
  return range(
    sunrise + length * index,
    sunrise + length * (index + 1),
  );
}

function jd(ms: number): number {
  const d = new Date(ms);
  const hours =
    d.getUTCHours() +
    d.getUTCMinutes() / 60 +
    d.getUTCSeconds() / 3600 +
    d.getUTCMilliseconds() / 3600000;

  return swe.julday(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    hours,
    GREGORIAN,
  );
}

function longitude(
  ms: number,
  planet: number,
): number {
  const result = swe.calc_ut(
    jd(ms), planet, FLAGS,
  );

  if (
    !result ||
    !Array.isArray(result.data) ||
    !Number.isFinite(result.data[0]) ||
    result.flag < 0 ||
    (result.flag & MOSEPH) === 0 ||
    (result.flag & SIDEREAL) === 0
  ) {
    throw new Error(
      `Ephemeris error: ${
        result?.error || 'Invalid calculation'
      }`,
    );
  }

  return norm(result.data[0]);
}

function astronomy(ms: number) {
  const sun = longitude(ms, SUN);
  const moon = longitude(ms, MOON);

  return {
    sun,
    moon,
    phase: norm(moon - sun),
    yoga: norm(moon + sun),
  };
}

function tithiIndex(ms: number): number {
  return Math.floor(astronomy(ms).phase / 12);
}

function nakshatraIndex(ms: number): number {
  return Math.floor(
    astronomy(ms).moon / (360 / 27),
  );
}

function yogaIndex(ms: number): number {
  return Math.floor(
    astronomy(ms).yoga / (360 / 27),
  );
}

function karanaIndex(ms: number): number {
  return Math.floor(astronomy(ms).phase / 6);
}

function tithiName(index: number): string {
  if (index === 14) return 'Shukla Purnima';
  if (index === 29) return 'Krishna Amavasya';

  return (
    (index < 15 ? 'Shukla ' : 'Krishna ') +
    TITHIS[index % 15]
  );
}

function karanaName(index: number): string {
  if (index === 0) return 'Kimstughna';
  if (index === 57) return 'Shakuni';
  if (index === 58) return 'Chatushpada';
  if (index === 59) return 'Naga';

  return KARANAS[(index - 1) % 7];
}

function transition(
  start: number,
  indexAt: (ms: number) => number,
): number {
  const initial = indexAt(start);
  let left = start;

  for (
    let right = start + HOUR_MS;
    right <= start + 3 * DAY_MS;
    right += HOUR_MS
  ) {
    if (indexAt(right) !== initial) {
      let low = left;
      let high = right;

      for (let i = 0; i < 32; i++) {
        const middle = (low + high) / 2;

        if (indexAt(middle) === initial) {
          low = middle;
        } else {
          high = middle;
        }
      }

      return high;
    }

    left = right;
  }

  throw new Error('Transition not found');
}

function getTithiIntervals(
  start: number,
  end: number,
): Array<{
  index: number;
  start: number;
  end: number;
}> {
  const intervals: Array<{
    index: number;
    start: number;
    end: number;
  }> = [];

  let cursor = start;

  while (cursor < end) {
    const index = tithiIndex(cursor);
    const nextChange = transition(
      cursor,
      tithiIndex,
    );

    const intervalEnd = Math.min(
      nextChange,
      end,
    );

    if (intervalEnd <= cursor) {
      throw new Error(
        'Invalid Tithi interval',
      );
    }

    intervals.push({
      index,
      start: cursor,
      end: intervalEnd,
    });

    cursor = intervalEnd;
  }

  return intervals;
}

function withEnding(
  name: string,
  sunrise: number,
  indexAt: (ms: number) => number,
): string {
  const end = transition(sunrise, indexAt);
  const extra =
    istDate(sunrise) === istDate(end)
      ? ''
      : ` (${istDate(end)})`;

  return `${name} • Until ${formatIST(end)}${extra}`;
}

function moonDistance(ms: number): number {
  const phase = astronomy(ms).phase;
  return phase > 180 ? phase - 360 : phase;
}

function refineNewMoon(
  low: number,
  high: number,
): number {
  for (let i = 0; i < 38; i++) {
    const mid = (low + high) / 2;

    if (moonDistance(mid) < 0) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

function findNewMoon(
  start: number,
  direction: -1 | 1,
): number {
  const step = 6 * HOUR_MS;
  let previous = start;
  let previousValue = moonDistance(start);

  for (let i = 1; i <= 160; i++) {
    const current =
      start + direction * i * step;

    const value = moonDistance(current);

    if (
      direction === 1 &&
      previousValue < 0 &&
      value >= 0
    ) {
      return refineNewMoon(previous, current);
    }

    if (
      direction === -1 &&
      value < 0 &&
      previousValue >= 0
    ) {
      return refineNewMoon(current, previous);
    }

    previous = current;
    previousValue = value;
  }

  throw new Error('New Moon not found');
}

function solarSign(ms: number): number {
  return Math.floor(
    astronomy(ms).sun / 30,
  ) % 12;
}

function amantaMonth(sunrise: number) {
  const previous = findNewMoon(
    sunrise - 1000, -1,
  );

  const next = findNewMoon(
    sunrise + 1000, 1,
  );

  const beforeSign = solarSign(
    previous + 60000,
  );

  const afterSign = solarSign(
    next + 60000,
  );

  const difference =
    (afterSign - beforeSign + 12) % 12;

  if (difference === 0) {
    const following = findNewMoon(
      next + HOUR_MS, 1,
    );

    const followingSign = solarSign(
      following + 60000,
    );

    const followingDifference =
      (followingSign - afterSign + 12) % 12;

    if (followingDifference !== 1) {
      throw new Error(
        'Exceptional lunar month requires review',
      );
    }

    return {
      masa:
        `Adhika ${MONTHS[followingSign]} (Amanta)`,
      adhikaMasa: true,
      kshayaMasa: false,
    };
  }

  if (difference === 2) {
    return {
      masa:
        `${MONTHS[afterSign]} (Amanta; Kshaya boundary)`,
      adhikaMasa: false,
      kshayaMasa: true,
    };
  }

  if (difference !== 1) {
    throw new Error(
      'Unexpected lunar month transition',
    );
  }

  return {
    masa: `${MONTHS[afterSign]} (Amanta)`,
    adhikaMasa: false,
    kshayaMasa: false,
  };
}

function sunriseFor(
  date: string,
  latitude: number,
  longitude: number,
): number {
  const start = istStart(date);
  const observer = new Observer(
    latitude, longitude, 0,
  );

  const event = SearchRiseSet(
    Body.Sun,
    observer,
    1,
    new Date(start),
    1,
  );

  if (!event) {
    throw new Error(`No sunrise for ${date}`);
  }

  const ms = event.date.getTime();

  if (ms < start || ms >= start + DAY_MS) {
    throw new Error(`Invalid sunrise for ${date}`);
  }

  return ms;
}

// Preliminary Karnataka Ugadi rule:
// Find Chaitra's starting conjunction and
// assign the day containing Pratipada at
// sunrise. When skipped at sunrise, assign
// the date on which Pratipada begins.
function ugadiDate(
  year: number,
  latitude: number,
  longitude: number,
): string {
  const key = `${year}:${latitude}:${longitude}`;
  const cached = ugadiCache.get(key);

  if (cached) return cached;

  let cursor = Date.UTC(year, 1, 15);
  const limit = Date.UTC(year, 4, 15);

  while (cursor < limit) {
    const conjunction = findNewMoon(cursor, 1);

    if (conjunction >= limit) break;

    const followingSunrise =
      conjunction + 2 * DAY_MS;

    const month = amantaMonth(followingSunrise);

    if (
      month.masa === 'Chaitra (Amanta)'
    ) {
      const startDate = istDate(conjunction);
      const nextDate = addDate(startDate, 1);

      const sunrise1 = sunriseFor(
        startDate, latitude, longitude,
      );

      const sunrise2 = sunriseFor(
        nextDate, latitude, longitude,
      );

      const end = transition(
        conjunction + 60000,
        tithiIndex,
      );

      let result: string;

      if (
        sunrise1 >= conjunction &&
        sunrise1 < end
      ) {
        result = startDate;
      } else if (
        sunrise2 >= conjunction &&
        sunrise2 < end
      ) {
        result = nextDate;
      } else if (
        sunrise1 < conjunction &&
        sunrise2 >= end
      ) {
        result = startDate;
      } else {
        throw new Error(
          `Ugadi rule needs review for ${year}`,
        );
      }

      ugadiCache.set(key, result);
      return result;
    }

    cursor = conjunction + DAY_MS;
  }

  throw new Error(
    `Unable to calculate Ugadi for ${year}`,
  );
}

function samvatsara(
  date: string,
  latitude: number,
  longitude: number,
): string {
  const year = Number(date.slice(0, 4));

  const ugadi = ugadiDate(
    year, latitude, longitude,
  );

  const cycleYear =
    date >= ugadi ? year : year - 1;

  // Parabhava is index 39 in the cycle.
  const index = (
    (cycleYear - 2026 + 39) % 60 + 60
  ) % 60;

  return `${SAMVATSARAS[index]} Samvatsara`;
}

function ayana(sun: number): string {
  const sign = Math.floor(sun / 30);

  return sign >= 9 || sign < 3
    ? 'Uttarayana'
    : 'Dakshinayana';
}

function ritu(sun: number): string {
  const sign = Math.floor(sun / 30);

  if (sign < 2) return 'Vasanta Ritu';
  if (sign < 4) return 'Grishma Ritu';
  if (sign < 6) return 'Varsha Ritu';
  if (sign < 8) return 'Sharad Ritu';
  if (sign < 10) return 'Hemanta Ritu';

  return 'Shishira Ritu';
}

export function calculatePanchangam(
  date: string,
  latitude: number,
  longitude: number,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(
      'Invalid date or coordinates',
    );
  }

  const parsed = new Date(
    `${date}T00:00:00.000Z`,
  );

  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new Error('Invalid date');
  }

  const start = istStart(date);
  const end = start + DAY_MS;

  const observer = new Observer(
    latitude, longitude, 0,
  );

  const sunriseEvent = SearchRiseSet(
    Body.Sun,
    observer,
    1,
    new Date(start),
    1,
  );

  const sunsetEvent = SearchRiseSet(
    Body.Sun,
    observer,
    -1,
    new Date(start),
    1,
  );

  if (!sunriseEvent || !sunsetEvent) {
    throw new Error(
      'Sunrise or sunset unavailable',
    );
  }

  const sunrise = sunriseEvent.date.getTime();
  const sunset = sunsetEvent.date.getTime();

  if (
    sunrise < start ||
    sunrise >= end ||
    sunset < start ||
    sunset >= end ||
    sunset <= sunrise
  ) {
    throw new Error(
      'Invalid sunrise or sunset',
    );
  }

  const weekday = parsed.getUTCDay();
  const daylight = sunset - sunrise;

  const astro = astronomy(sunrise);
  const tithi = tithiIndex(sunrise);
  const nakshatra = nakshatraIndex(sunrise);
  const yogaNumber = yogaIndex(sunrise);
  const karana = karanaIndex(sunrise);

  
  const month = amantaMonth(sunrise);

  // Previous and next dates
  const previousDate = addDate(date, -1);
  const nextDate = addDate(date, 1);

  // Previous day's sunrise
  const previousSunrise = sunriseFor(
    previousDate,
    latitude,
    longitude,
  );

  // Next day's sunrise
  const nextSunrise = sunriseFor(
    nextDate,
    latitude,
    longitude,
  );

  // Next day's sunset
  const nextDayStart = istStart(nextDate);

  const nextDayObserver = new Observer(
    latitude,
    longitude,
    0,
  );

  const nextSunsetEvent = SearchRiseSet(
    Body.Sun,
    nextDayObserver,
    -1,
    new Date(nextDayStart),
    1,
  );

  if (!nextSunsetEvent) {
    throw new Error(
      'Next-day sunset unavailable',
    );
  }

  const nextSunset =
    nextSunsetEvent.date.getTime();

  if (
    nextSunset < nextDayStart ||
    nextSunset >= nextDayStart + DAY_MS ||
    nextSunset <= nextSunrise
  ) {
    throw new Error(
      'Invalid next-day sunset',
    );
  }

  // Exact astronomical Tithi intervals
  const tithiIntervals = getTithiIntervals(
    sunrise,
    Math.max(
      nextSunrise,
      sunset + 45 * 60000,
    ),
  );

  // Calculate Ekadashi, Pradosha,
  // Purnima and Amavasya candidates
  const observances = calculateObservances({
        arunodayaTime: sunrise - 96 * 60000,

    arunodayaTithi: tithiIndex(
      sunrise - 96 * 60000,
    ),
    sunrise,
    nextSunrise,
    sunset,
    nextSunset,

    previousSunriseTithi:
      tithiIndex(previousSunrise),

    sunriseTithi: tithi,

    nextSunriseTithi:
      tithiIndex(nextSunrise),

    tithiIntervals,
  });
   
  const parana = calculateParanaCandidate({
    sunrise,
  nextSunrise,
  sunset,

    sunriseTithi: tithi,

    tithiAt: tithiIndex,

    nextTransition: (time: number) =>
      transition(time, tithiIndex),

    tithiIntervals,
  });


  // Solar Rashi
  const rashiIndex = Math.floor(
    astro.sun / 30,
  ) % 12;
  const ekadashiAssessment = assessEkadashi({
  date,
  sunriseTithi: tithi,
  arunodayaTithi: tithiIndex(
    sunrise - 96 * 60000
  ),
  previousSunriseTithi: tithiIndex(
    previousSunrise
  ),
  nextSunriseTithi: tithiIndex(
    nextSunrise
  ),
});

  // Assess the preceding calendar day's Ekadashi
  // using its actual sunrise and Arunodaya.

 
  // Calculate calendar dates independently of
  // the IST-to-UTC timestamp conversion.

  const previousCalendarDate = new Date(
    Date.parse(`${date}T00:00:00.000Z`) - DAY_MS,
  )
    .toISOString()
    .slice(0, 10);

  const previousPreviousDate = new Date(
    Date.parse(
      `${previousCalendarDate}T00:00:00.000Z`,
    ) - DAY_MS,
  )
    .toISOString()
    .slice(0, 10);


  const previousPreviousSunrise = sunriseFor(
    previousPreviousDate,
    latitude,
    longitude,
  );

  const previousEkadashiAssessment = assessEkadashi({
    date: previousCalendarDate,

    sunriseTithi: tithiIndex(
      previousSunrise,
    ),

    arunodayaTithi: tithiIndex(
      previousSunrise - 96 * 60000,
    ),

    previousSunriseTithi: tithiIndex(
      previousPreviousSunrise,
    ),

    nextSunriseTithi: tithi,
  });

  // Link the preceding Ekadashi candidate
  // with the selected day's Dwadashi data.

  const paranaLink = linkParanaToEkadashi({
    date,

    previousDate: previousCalendarDate,

    previousEkadashiAssessment,

    currentParana: parana,
  });

const ekadashiDiagnostics = {
  arunodayaTime: new Date(
    sunrise - 96 * 60000,
  ).toISOString(),

  arunodayaTithi: tithiIndex(
    sunrise - 96 * 60000,
  ),

  sunriseTithi: tithi,

  nextSunriseTithi: tithiIndex(
    nextSunrise,
  ),
};
  return {
    date,
    ekadashiAssessment,
    latitude,
    longitude,
    timezone: 'Asia/Kolkata',

    sunrise: formatIST(sunrise),
    sunset: formatIST(sunset),

    vara: WEEKDAYS[weekday],

    rahuKalam: segment(
      sunrise, sunset, RAHU[weekday],
    ),

    yamaganda: segment(
      sunrise, sunset, YAMAGANDA[weekday],
    ),

    gulikaKalam: segment(
      sunrise, sunset, GULIKA[weekday],
    ),

    abhijitMuhurtham: range(
      sunrise + daylight * 7 / 15,
      sunrise + daylight * 8 / 15,
    ),

    tithi: withEnding(
      tithiName(tithi),
      sunrise,
      tithiIndex,
    ),

    nakshatra: withEnding(
      NAKSHATRAS[nakshatra],
      sunrise,
      nakshatraIndex,
    ),

    yoga: withEnding(
      YOGAS[yogaNumber],
      sunrise,
      yogaIndex,
    ),

    karana: withEnding(
      karanaName(karana),
      sunrise,
      karanaIndex,
    ),

    paksha:
      tithi < 15
        ? 'Shukla Paksha'
        : 'Krishna Paksha',

    masa: month.masa,

    samvatsara: samvatsara(
      date, latitude, longitude,
    ),

    ayana: ayana(astro.sun),
    ritu: ritu(astro.sun),

    observances,
    parana,
    paranaLink,
    ekadashiDiagnostics,

    solarRashi: RASHIS[rashiIndex],

    adhikaMasa: month.adhikaMasa,
    kshayaMasa: month.kshayaMasa,

    calculationStatus: 'partial',

    calculationNote:
      'Dynamic astronomical calculations use ' +
      'Swiss Ephemeris Moshier and Lahiri ayanamsa. ' +
      'The Ugadi, Amanta, exceptional-month and ' +
      'regional observance rules remain preliminary ' +
      'and require independent validation.',
  };
}
