
export interface EkadashiAssessmentInput {
  date: string;
  sunriseTithi: number;
  arunodayaTithi: number;
  previousSunriseTithi: number;
  nextSunriseTithi: number;
}

export interface EkadashiAssessment {
  date: string;
  paksha: 'Shukla' | 'Krishna';
  status: 'review-required';

  ekadashiAtSunrise: boolean;
  ekadashiAtArunodaya: boolean;

  dwadashiSkippedAtSunrise: boolean;

  smarta: {
    fastingDate: string | null;
    status: 'review-required';
  };

  madhwaVaishnava: {
    fastingDate: string | null;
    status: 'review-required';
  };

  parana: {
    fastingDate: string | null;
    paranaDate: string | null;
    status: 'review-required';
  };

  note: string;
}

function nextDate(date: string): string {
  const timestamp =
    Date.parse(`${date}T00:00:00.000Z`);

  return new Date(timestamp + 86400000)
    .toISOString()
    .slice(0, 10);
}

export function assessEkadashi(
  input: EkadashiAssessmentInput,
): EkadashiAssessment | null {
  const {
    date,
    sunriseTithi,
    arunodayaTithi,
    previousSunriseTithi,
    nextSunriseTithi,
  } = input;

  const isShukla = sunriseTithi === 10;
  const isKrishna = sunriseTithi === 25;

  if (!isShukla && !isKrishna) {
    return null;
  }

  const paksha = isShukla
    ? 'Shukla'
    : 'Krishna';

  const ekadashiIndex = isShukla ? 10 : 25;
  const dwadashiIndex = ekadashiIndex + 1;

  const repeatedEkadashi =
    previousSunriseTithi === ekadashiIndex ||
    nextSunriseTithi === ekadashiIndex;

  const dwadashiSkippedAtSunrise =
    nextSunriseTithi > dwadashiIndex;

  const arunodayaClean =
    arunodayaTithi === ekadashiIndex;

  // These dates are candidates for review,
  // not verified fasting or Parana dates.

  const candidateFastingDate = date;

const dashamiAtArunodaya =
  arunodayaTithi === ekadashiIndex - 1;

const requiresSpecialReview =
  repeatedEkadashi ||
  dwadashiSkippedAtSunrise ||
  dashamiAtArunodaya;

const candidateParanaDate =
  requiresSpecialReview
    ? null
    : nextDate(date);

  return {
    date,
    paksha,
    status: 'review-required',

    ekadashiAtSunrise: true,
    ekadashiAtArunodaya: arunodayaClean,

    dwadashiSkippedAtSunrise,

    smarta: {
      fastingDate: repeatedEkadashi
        ? null
        : candidateFastingDate,
      status: 'review-required',
    },

    madhwaVaishnava: {
      fastingDate:
        !repeatedEkadashi && arunodayaClean
          ? candidateFastingDate
          : null,
      status: 'review-required',
    },

parana: {
  fastingDate: requiresSpecialReview
    ? null
    : candidateFastingDate,

  paranaDate: candidateParanaDate,

  status: 'review-required',
},

    note:
      'Preliminary Ekadashi assessment only. ' +
      'Smarta and Madhwa/Vaishnava fasting rules, ' +
      'Dashami Vedha, repeated Tithi and Parana ' +
      'requirements must be independently ' +
      'validated before publication.',
  };
}
