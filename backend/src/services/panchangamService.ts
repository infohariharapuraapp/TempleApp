
import {
  Body,
  Observer,
  SearchRiseSet,
  MoonPhase,
  EclipticGeoMoon,
  GeoVector,
  Ecliptic,
} from 'astronomy-engine';

const IST_OFFSET = 330 * 60 * 1000;
const DAY_MS = 86400000;
const HOUR_MS = 3600000;

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
  'Trayodashi', 'Chaturdashi',
  'Purnima',
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

const MOVABLE_KARANAS = [
  'Bava', 'Balava', 'Kaulava',
  'Taitila', 'Garaja', 'Vanija',
  'Vishti (Bhadra)',
];

function normalize(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function formatIST(ms: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(ms));
}

function formatRange(
  start: number,
  end: number,
): string {
  return `${formatIST(start)} - ${formatIST(end)}`;
}

function period(
  sunrise: number,
  sunset: number,
  segment: number,
): string {
  const part = (sunset - sunrise) / 8;

  return formatRange(
    sunrise + part * segment,
    sunrise + part * (segment + 1),
  );
}

// Approximate Lahiri ayanamsa.
// Must be replaced with validated ephemeris
// calculations before authoritative use.
function approximateAyanamsa(ms: number): number {
  const jd = ms / DAY_MS + 2440587.5;
  const years = (jd - 2451545.0) / 365.2425;

  return 23.85675 + years * (50.29 / 3600);
}

function sunLongitude(ms: number): number {
  const vector = GeoVector(
    Body.Sun,
    new Date(ms),
    true,
  );

  return normalize(Ecliptic(vector).elon);
}

function moonLongitude(ms: number): number {
  return normalize(
    EclipticGeoMoon(new Date(ms)).lon,
  );
}

function astronomy(ms: number) {
  const ayanamsa = approximateAyanamsa(ms);

  const sun = sunLongitude(ms);
  const moon = moonLongitude(ms);

  const siderealSun = normalize(sun - ayanamsa);
  const siderealMoon = normalize(moon - ayanamsa);

  const phase = MoonPhase(new Date(ms));

  return {
    phase,
    siderealSun,
    siderealMoon,
    yogaAngle: normalize(
      siderealSun + siderealMoon,
    ),
  };
}

function tithiIndex(ms: number): number {
  return Math.floor(astronomy(ms).phase / 12);
}

function nakshatraIndex(ms: number): number {
  return Math.floor(
    astronomy(ms).siderealMoon / (360 / 27),
  );
}

function yogaIndex(ms: number): number {
  return Math.floor(
    astronomy(ms).yogaAngle / (360 / 27),
  );
}

function karanaIndex(ms: number): number {
  return Math.floor(astronomy(ms).phase / 6);
}

function getTithiName(index: number): string {
  const number = index % 15;

  if (index === 29) {
    return 'Amavasya';
  }

  const name = TITHIS[number];

  return index < 15
    ? `Shukla ${name}`
    : `Krishna ${name}`;
}

function getKaranaName(index: number): string {
  if (index === 0) return 'Kimstughna';
  if (index === 57) return 'Shakuni';
  if (index === 58) return 'Chatushpada';
  if (index === 59) return 'Naga';

  return MOVABLE_KARANAS[(index - 1) % 7];
}

// Find the next transition of a Panchanga
// element using coarse sampling and bisection.
function findTransition(
  start: number,
  indexAt: (ms: number) => number,
): number | null {
  const initial = indexAt(start);
  let left = start;

  const max = start + 3 * DAY_MS;
  const step = HOUR_MS;

  for (
    let right = start + step;
    right <= max;
    right += step
  ) {
    if (indexAt(right) !== initial) {
      let low = left;
      let high = right;

      for (let i = 0; i < 35; i++) {
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

  return null;
}

function elementWithEnd(
  name: string,
  start: number,
  indexAt: (ms: number) => number,
): string {
  const end = findTransition(start, indexAt);

  if (end === null) {
    return name;
  }

  const startDay = new Date(
    start + IST_OFFSET,
  ).getUTCDate();

  const endDay = new Date(
    end + IST_OFFSET,
  ).getUTCDate();

  const dayNote =
    startDay === endDay
      ? ''
      : ' (next day or later)';

  return `${name} • Until ${formatIST(end)}${dayNote}`;
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
    throw new Error('Invalid date or coordinates');
  }

  const start =
    new Date(`${date}T00:00:00.000Z`).getTime()
    - IST_OFFSET;

  if (!Number.isFinite(start)) {
    throw new Error('Invalid Panchangam date');
  }

  const end = start + DAY_MS;

  const observer = new Observer(
    latitude,
    longitude,
    0,
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
      'Sunrise or sunset could not be calculated',
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
      'Valid sunrise and sunset were not found',
    );
  }

  const weekday = new Date(
    `${date}T00:00:00.000Z`,
  ).getUTCDay();

  const daylight = sunset - sunrise;

  const abhijitStart =
    sunrise + daylight * (7 / 15);

  const abhijitEnd =
    sunrise + daylight * (8 / 15);

  // Hindu day is evaluated at local sunrise.
  const tithiNumber = tithiIndex(sunrise);
  const nakshatraNumber = nakshatraIndex(sunrise);
  const yogaNumber = yogaIndex(sunrise);
  const karanaNumber = karanaIndex(sunrise);

  const paksha =
    tithiNumber < 15
      ? 'Shukla Paksha'
      : 'Krishna Paksha';

  return {
    date,
    latitude,
    longitude,
    timezone: 'Asia/Kolkata',

    sunrise: formatIST(sunrise),
    sunset: formatIST(sunset),

    vara: WEEKDAYS[weekday],

    rahuKalam: period(
      sunrise,
      sunset,
      RAHU[weekday],
    ),

    yamaganda: period(
      sunrise,
      sunset,
      YAMAGANDA[weekday],
    ),

    gulikaKalam: period(
      sunrise,
      sunset,
      GULIKA[weekday],
    ),

    abhijitMuhurtham: formatRange(
      abhijitStart,
      abhijitEnd,
    ),

    tithi: elementWithEnd(
      getTithiName(tithiNumber),
      sunrise,
      tithiIndex,
    ),

    nakshatra: elementWithEnd(
      NAKSHATRAS[nakshatraNumber],
      sunrise,
      nakshatraIndex,
    ),

    yoga: elementWithEnd(
      YOGAS[yogaNumber],
      sunrise,
      yogaIndex,
    ),

    karana: elementWithEnd(
      getKaranaName(karanaNumber),
      sunrise,
      karanaIndex,
    ),

    paksha,

    // Requires complete, validated calendar rules.
    samvatsara: null,
    masa: null,
    ayana: null,
    ritu: null,

    observances: [],

    calculationStatus: 'partial',

    calculationNote:
      'Preliminary astronomical Panchangam. ' +
      'Sidereal calculations use an approximate ' +
      'ayanamsa. Lunar months, traditional years, ' +
      'seasons and festivals require validation.',
  };
}
