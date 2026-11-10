
import {
  Body,
  Observer,
  SearchRiseSet,
} from 'astronomy-engine';

const IST_OFFSET = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

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

export function calculatePanchangam(
  date: string,
  latitude: number,
  longitude: number,
) {
  const start =
    new Date(`${date}T00:00:00.000Z`).getTime()
    - IST_OFFSET;

  const end = start + DAY_MS;

  const observer = new Observer(
    latitude,
    longitude,
    0,
  );

  // Search from the start of the selected IST date.
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

  // Ensure both events belong to the requested IST date.
  if (
    sunrise < start ||
    sunrise >= end ||
    sunset < start ||
    sunset >= end ||
    sunset <= sunrise
  ) {
    throw new Error(
      'Valid sunrise and sunset were not found for this date',
    );
  }

  const weekday = new Date(
    `${date}T00:00:00.000Z`,
  ).getUTCDay();

  const daylight = sunset - sunrise;

  // Conventional Abhijit interval:
  // the middle one of 15 equal daylight muhurtas.
  const abhijitStart = sunrise + daylight * (7 / 15);
  const abhijitEnd = sunrise + daylight * (8 / 15);

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

    // Not yet implemented or validated.
    tithi: null,
    nakshatra: null,
    yoga: null,
    karana: null,

    samvatsara: null,
    masa: null,
    paksha: null,
    ayana: null,
    ritu: null,

    observances: [],

    calculationStatus: 'partial',
    calculationNote:
      'Solar timings are astronomical estimates. ' +
      'Traditional calendar elements are pending validation.',
  };
}
