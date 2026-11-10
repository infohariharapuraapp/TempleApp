
export interface TithiInterval {
  index: number;
  start: number;
  end: number;
}

export interface ParanaInput {
  sunrise: number;
  sunset: number;
  sunriseTithi: number;
  nextSunrise: number;

  tithiAt: (time: number) => number;
  nextTransition: (time: number) => number;

  tithiIntervals: TithiInterval[];
}

export interface ParanaResult {
  status: 'candidate' | 'review-required';

  dwadashiStart: string | null;
  dwadashiEnd: string | null;
  hariVasaraEnd: string | null;

  suggestedStart: string | null;
  suggestedEnd: string | null;

  note: string;

  // Additional diagnostic fields.
  dwadashiAtSunrise: boolean;
  dwadashiSkippedAtSunrise: boolean;
  tradition: 'unconfirmed';
}

const HOUR = 3600000;
const MINUTE = 60000;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function findTithiStart(
  activeTime: number,
  target: number,
  tithiAt: (time: number) => number,
): number | null {
  let cursor = activeTime;

  for (let i = 0; i < 72; i++) {
    const earlier = cursor - HOUR;

    if (tithiAt(earlier) !== target) {
      let low = earlier;
      let high = cursor;

      for (let j = 0; j < 40; j++) {
        const mid = (low + high) / 2;

        if (tithiAt(mid) === target) {
          high = mid;
        } else {
          low = mid;
        }
      }

      return high;
    }

    cursor = earlier;
  }

  return null;
}

function reviewResult(
  note: string,
  dwadashiStart: number | null,
  dwadashiEnd: number | null,
  hariVasaraEnd: number | null,
  dwadashiAtSunrise: boolean,
  dwadashiSkippedAtSunrise: boolean,
): ParanaResult {
  return {
    status: 'review-required',

    dwadashiStart:
      dwadashiStart === null
        ? null
        : iso(dwadashiStart),

    dwadashiEnd:
      dwadashiEnd === null
        ? null
        : iso(dwadashiEnd),

    hariVasaraEnd:
      hariVasaraEnd === null
        ? null
        : iso(hariVasaraEnd),

    suggestedStart: null,
    suggestedEnd: null,

    dwadashiAtSunrise,
    dwadashiSkippedAtSunrise,
    tradition: 'unconfirmed',

    note,
  };
}

export function calculateParanaCandidate(
  input: ParanaInput,
): ParanaResult | null {
  const {
    sunrise,
    nextSunrise,
    sunset,
    sunriseTithi,
    tithiAt,
    nextTransition,
    tithiIntervals,
  } = input;

  // Shukla Dwadashi = 11
  // Krishna Dwadashi = 26

  const dwadashi = tithiIntervals.find(
    interval =>
      (interval.index === 11 ||
        interval.index === 26) &&
      interval.start < interval.end &&
      interval.end > sunrise &&
      interval.start < sunset,
  );

  if (!dwadashi) {
    return null;
  }

  const dwadashiIndex = dwadashi.index;

  const activeTime =
    (dwadashi.start + dwadashi.end) / 2;

  if (tithiAt(activeTime) !== dwadashiIndex) {
    return reviewResult(
      'Dwadashi interval could not be verified.',
      null,
      null,
      null,
      false,
      false,
    );
  }

  const dwadashiStart = findTithiStart(
    activeTime,
    dwadashiIndex,
    tithiAt,
  );

  if (dwadashiStart === null) {
    return reviewResult(
      'Unable to determine Dwadashi start.',
      null,
      null,
      null,
      false,
      false,
    );
  }

  const dwadashiEnd = nextTransition(
    activeTime,
  );

  if (
    !Number.isFinite(dwadashiEnd) ||
    dwadashiEnd <= dwadashiStart
  ) {
    return reviewResult(
      'Unable to determine Dwadashi end.',
      dwadashiStart,
      null,
      null,
      false,
      false,
    );
  }

  // Preliminary Hari Vasara boundary:
  // First quarter of Dwadashi.
  // This is diagnostic only.

  const hariVasaraEnd =
    dwadashiStart +
    (dwadashiEnd - dwadashiStart) / 4;

  const dwadashiAtSunrise =
    sunriseTithi === dwadashiIndex;

  // Check the next local sunrise approximately.
  // NOTE: This is only a screening approximation.
  // A future improvement will pass the actual
  // next sunrise from panchangamService.ts.

  const dwadashiSkippedAtSunrise =
  !dwadashiAtSunrise &&
  dwadashiStart > sunrise &&
  dwadashiEnd < nextSunrise;

  // Do not produce an official Parana time
  // without validating the fasting date
  // and the applicable religious tradition.

  if (dwadashiSkippedAtSunrise) {
    return reviewResult(
      'Dwadashi occurs between consecutive ' +
        'sunrises and is skipped at sunrise. ' +
        'The correct Parana procedure requires ' +
        'Smarta or Madhwa/Vaishnava validation. ' +
        'No fasting-breaking time is published.',
      dwadashiStart,
      dwadashiEnd,
      hariVasaraEnd,
      dwadashiAtSunrise,
      true,
    );
  }

  if (!dwadashiAtSunrise) {
    return reviewResult(
      'Dwadashi begins after sunrise. ' +
        'The Ekadashi fasting date and ' +
        'Parana procedure must be verified ' +
        'before publishing any time.',
      dwadashiStart,
      dwadashiEnd,
      hariVasaraEnd,
      false,
      false,
    );
  }

  // Even when Dwadashi is present at sunrise,
  // tradition-specific rules still apply.

  const earliestDiagnosticStart = Math.max(
    sunrise,
    hariVasaraEnd,
  );

  const middayLimit =
    sunrise + (sunset - sunrise) / 2;

  const latestDiagnosticEnd = Math.min(
    dwadashiEnd,
    middayLimit,
  );

  // Keep calculations available internally
  // but do not publish them as Parana times.

  void earliestDiagnosticStart;
  void latestDiagnosticEnd;
  void MINUTE;

  return reviewResult(
    'Dwadashi is present at sunrise. ' +
      'Astronomical boundaries were calculated, ' +
      'but the correct fasting date, ' +
      'Hari Vasara rules, and tradition-specific ' +
      'Parana procedure require validation. ' +
      'No official Parana window is published.',
    dwadashiStart,
    dwadashiEnd,
    hariVasaraEnd,
    true,
    false,
  );
}
