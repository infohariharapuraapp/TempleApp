
export interface Observance {
  name: string;
  type: 'tithi-based' | 'provisional';
  description: string;
}

export interface TithiInterval {
  index: number;
  start: number;
  end: number;
}

export interface ObservanceInput {
  arunodayaTithi: number;
  arunodayaTime: number;

  sunrise: number;
  nextSunrise: number;
  sunset: number;
  nextSunset: number;

  previousSunriseTithi: number;
  sunriseTithi: number;
  nextSunriseTithi: number;

  tithiIntervals: TithiInterval[];
}

const MINUTE = 60000;

function overlaps(
  a: number,
  b: number,
  c: number,
  d: number,
): boolean {
  return Math.max(a, c) < Math.min(b, d);
}

function hasTithi(
  intervals: TithiInterval[],
  index: number,
  start: number,
  end: number,
): boolean {
  return intervals.some(
    item =>
      item.index === index &&
      overlaps(
        item.start,
        item.end,
        start,
        end,
      ),
  );
}

function add(
  result: Observance[],
  name: string,
  description: string,
): void {
  if (result.some(item => item.name === name)) {
    return;
  }

  result.push({
    name,
    type: 'provisional',
    description,
  });
}

export function calculateObservances(
  input: ObservanceInput,
): Observance[] {
  const result: Observance[] = [];

  const {
    arunodayaTithi,
    arunodayaTime,
    sunrise,
    nextSunrise,
    sunset,
    nextSunset,
    previousSunriseTithi,
    sunriseTithi,
    nextSunriseTithi,
    tithiIntervals,
  } = input;

  // ==========================================
  // 1. EKADASHI SCREENING
  // ==========================================
  // Zero-based Tithi indexes:
  //
  // Shukla Dashami    = 9
  // Shukla Ekadashi   = 10
  // Shukla Dwadashi   = 11
  //
  // Krishna Dashami   = 24
  // Krishna Ekadashi  = 25
  // Krishna Dwadashi  = 26
  //
  // All fasting decisions remain provisional.

  for (const target of [10, 25]) {
    const paksha =
      target === 10 ? 'Shukla' : 'Krishna';

    const dashamiIndex = target - 1;
    const dwadashiIndex = target + 1;

    const atSunrise =
      sunriseTithi === target;

    const atNextSunrise =
      nextSunriseTithi === target;

    const duringDay = hasTithi(
      tithiIntervals,
      target,
      sunrise,
      nextSunrise,
    );

    // ----------------------------------------
    // A. Ekadashi present at sunrise
    // ----------------------------------------

    if (atSunrise) {
      add(
        result,
        `${paksha} Ekadashi`,
        'Ekadashi Tithi is present at sunrise. ' +
          'This is an astronomical observation, ' +
          'not confirmation of the fasting date.',
      );

      // Smarta screening
      add(
        result,
        `Smarta ${paksha} Ekadashi review`,
        'Ekadashi is present at sunrise. ' +
          'Smarta fasting-date selection ' +
          'requires validation of the ' +
          'applicable traditional rules.',
      );

      // Madhwa / Vaishnava screening
      if (arunodayaTithi === target) {
        add(
          result,
          `Madhwa/Vaishnava ${paksha} Ekadashi review`,
          'Ekadashi is present at both ' +
            'Arunodaya and sunrise. ' +
            'This is a candidate for further ' +
            'tradition-specific fasting-date ' +
            'validation, not an official date.',
        );
      } else if (
        arunodayaTithi === dashamiIndex
      ) {
        add(
          result,
          `${paksha} Ekadashi Dashami Vedha review`,
          'Dashami is present at the ' +
            '96-minute pre-sunrise checkpoint. ' +
            'Madhwa/Vaishnava fasting-date ' +
            'selection requires detailed ' +
            'Dashami Vedha validation.',
        );
      } else {
        add(
          result,
          `${paksha} Ekadashi dawn-boundary review`,
          'The Arunodaya and sunrise Tithis ' +
            'differ. Additional traditional ' +
            'rules are required.',
        );
      }
    }

    // ----------------------------------------
    // B. Ekadashi begins after sunrise
    // ----------------------------------------
    // Do not assign today's Smarta fast
    // merely because Ekadashi starts today.

    if (
      !atSunrise &&
      duringDay &&
      atNextSunrise
    ) {
      add(
        result,
        `${paksha} Ekadashi begins today`,
        'Ekadashi begins after sunrise and ' +
          'continues into the following sunrise. ' +
          'The next date must be evaluated ' +
          'for Smarta and Madhwa/Vaishnava ' +
          'fasting eligibility.',
      );
    }

    // ----------------------------------------
    // C. Ekadashi skipped at sunrise
    // ----------------------------------------

    if (
      !atSunrise &&
      !atNextSunrise &&
      duringDay
    ) {
      add(
        result,
        `${paksha} Ekadashi Tithi skipped at sunrise`,
        'Ekadashi occurs between consecutive ' +
          'sunrises but is absent at both. ' +
          'The fasting date requires ' +
          'special traditional rules.',
      );
    }

    // ----------------------------------------
    // D. Repeated Ekadashi
    // ----------------------------------------

    if (
      atSunrise &&
      (
        previousSunriseTithi === target ||
        atNextSunrise
      )
    ) {
      add(
        result,
        `${paksha} Ekadashi repeated Tithi`,
        'Ekadashi is present at consecutive ' +
          'sunrises. Tradition-specific ' +
          'fasting-date selection is required.',
      );
    }

    // ----------------------------------------
    // E. Skipped Dwadashi at sunrise
    // ----------------------------------------

    const dwadashiDuringDay = hasTithi(
      tithiIntervals,
      dwadashiIndex,
      sunrise,
      nextSunrise,
    );

    if (
      atSunrise &&
      dwadashiDuringDay &&
      nextSunriseTithi !== dwadashiIndex
    ) {
      add(
        result,
        `${paksha} Dwadashi skipped at sunrise`,
        'Dwadashi occurs before the next ' +
          'sunrise but is absent at that sunrise. ' +
          'Parana must be reviewed using ' +
          'tradition-specific rules. ' +
          'Do not publish an automatic ' +
          'fast-breaking time.',
      );
    }
  }

  // ==========================================
  // 2. PRADOSHA
  // ==========================================
  // Preliminary screening:
  // 45 minutes before/after sunset.

  const pradoshaStart =
    sunset - 45 * MINUTE;

  const pradoshaEnd =
    sunset + 45 * MINUTE;

  const shuklaPradosha = hasTithi(
    tithiIntervals,
    12,
    pradoshaStart,
    pradoshaEnd,
  );

  const krishnaPradosha = hasTithi(
    tithiIntervals,
    27,
    pradoshaStart,
    pradoshaEnd,
  );

  if (shuklaPradosha || krishnaPradosha) {
    add(
      result,
      'Pradosha',
      'Trayodashi overlaps the evening ' +
        'Pradosha screening window. ' +
        'Traditional observance-date ' +
        'selection requires validation.',
    );
  }

  // ==========================================
  // 3. PURNIMA
  // ==========================================

  if (sunriseTithi === 14) {
    add(
      result,
      'Purnima',
      'Purnima Tithi is present at sunrise. ' +
        'Festival-specific observance rules ' +
        'remain pending.',
    );
  }

  // ==========================================
  // 4. AMAVASYA
  // ==========================================

  if (sunriseTithi === 29) {
    add(
      result,
      'Amavasya',
      'Amavasya Tithi is present at sunrise. ' +
        'Traditional observance rules ' +
        'remain pending.',
    );
  }

  // ==========================================
  // 5. SKIPPED PURNIMA / AMAVASYA
  // ==========================================

  for (const target of [14, 29]) {
    const atSunrise =
      sunriseTithi === target;

    const atNextSunrise =
      nextSunriseTithi === target;

    const duringDay = hasTithi(
      tithiIntervals,
      target,
      sunrise,
      nextSunrise,
    );

    if (
      !atSunrise &&
      !atNextSunrise &&
      duringDay
    ) {
      add(
        result,
        target === 14
          ? 'Purnima Tithi skipped at sunrise'
          : 'Amavasya Tithi skipped at sunrise',
        'The Tithi occurs between consecutive ' +
          'sunrises but is absent at both. ' +
          'The religious observance date ' +
          'requires review.',
      );
    }
  }

  // Reserved for later tradition-specific
  // calculations and Parana integration.
  void arunodayaTime;
  void nextSunset;

  return result;
}
