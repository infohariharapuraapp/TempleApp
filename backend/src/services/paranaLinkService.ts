
export interface ParanaLinkInput {
  date: string;

  previousDate: string;

  previousEkadashiAssessment: {
    date: string;
    status: 'review-required';
    parana: {
      fastingDate: string | null;
      paranaDate: string | null;
      status: 'review-required';
    };
  } | null;

  currentParana: {
    status: 'candidate' | 'review-required';
    dwadashiStart: string | null;
    dwadashiEnd: string | null;
    dwadashiAtSunrise: boolean;
    dwadashiSkippedAtSunrise: boolean;
  } | null;
}

export interface ParanaLinkResult {
  fastingDate: string | null;
  paranaDate: string | null;

  status: 'review-required';

  linked: boolean;

  dwadashiStart: string | null;
  dwadashiEnd: string | null;

  note: string;
}

export function linkParanaToEkadashi(
  input: ParanaLinkInput,
): ParanaLinkResult | null {
  const {
    date,
    previousDate,
    previousEkadashiAssessment,
    currentParana,
  } = input;

  if (!previousEkadashiAssessment) {
    return null;
  }

  const previous =
    previousEkadashiAssessment;

  if (
    previous.date !== previousDate ||
    previous.parana.fastingDate !== previousDate
  ) {
    return null;
  }

  const candidateParanaDate =
    previous.parana.paranaDate;

  // The previous assessment must explicitly
  // nominate the selected date as its
  // preliminary Parana date.

  if (candidateParanaDate !== date) {
    return {
      fastingDate: previousDate,
      paranaDate: null,
      status: 'review-required',
      linked: false,
      dwadashiStart:
        currentParana?.dwadashiStart ?? null,
      dwadashiEnd:
        currentParana?.dwadashiEnd ?? null,
      note:
        'The preceding Ekadashi assessment ' +
        'does not nominate this date as a ' +
        'Parana candidate. Traditional rules ' +
        'must be reviewed.',
    };
  }

  if (!currentParana) {
    return {
      fastingDate: previousDate,
      paranaDate: date,
      status: 'review-required',
      linked: false,
      dwadashiStart: null,
      dwadashiEnd: null,
      note:
        'The previous Ekadashi assessment ' +
        'nominates this date, but Dwadashi ' +
        'was not detected in the current ' +
        'Parana calculation.',
    };
  }

  return {
    fastingDate: previousDate,
    paranaDate: date,
    status: 'review-required',
    linked: true,
    dwadashiStart:
      currentParana.dwadashiStart,
    dwadashiEnd:
      currentParana.dwadashiEnd,
    note:
      'Preliminary fasting-to-Parana date ' +
      'relationship established. This is ' +
      'not an official Parana date or time. ' +
      'Smarta/Madhwa/Vaishnava rules and ' +
      'temple tradition require validation.',
  };
}
