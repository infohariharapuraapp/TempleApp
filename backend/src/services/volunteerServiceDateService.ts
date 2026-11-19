import { PoolClient } from 'pg';

// ========================================
// SERVICE DATE VALIDATION
// ========================================

export class VolunteerServiceDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VolunteerServiceDateError';
  }
}

export function isValidServiceDate(
  value: unknown
): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const parsed = new Date(
    `${value}T00:00:00.000Z`
  );

  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

// ========================================
// NORMALIZE SELECTED DATES
// ========================================

export function normalizeServiceDates(
  value: unknown
): string[] {
  if (!Array.isArray(value) || !value.length) {
    throw new VolunteerServiceDateError(
      'Select at least one available service date'
    );
  }

  if (value.length > 366) {
    throw new VolunteerServiceDateError(
      'Too many selected service dates'
    );
  }

  if (!value.every(isValidServiceDate)) {
    throw new VolunteerServiceDateError(
      'Invalid service date'
    );
  }

  return [...new Set<string>(value)].sort();
}

// ========================================
// GET AVAILABLE SERVICE DATES
// ========================================

export async function getOpportunityServiceDates(
  client: PoolClient,
  opportunityId: number
): Promise<string[]> {
  const result = await client.query(
    `
    SELECT
      TO_CHAR(
        dates.service_date,
        'YYYY-MM-DD'
      ) AS service_date

    FROM volunteer_opportunities o

    CROSS JOIN LATERAL generate_series(
      GREATEST(
        o.service_start_date,
        (
          clock_timestamp()
          AT TIME ZONE 'Asia/Kolkata'
        )::date
      )::timestamp,

      o.service_end_date::timestamp,

      INTERVAL '1 day'
    ) AS dates(service_date)

    WHERE o.id = $1

    ORDER BY dates.service_date ASC
    `,
    [opportunityId]
  );

  return result.rows.map(
    row => String(row.service_date)
  );
}

// ========================================
// VALIDATE OPPORTUNITY DATE SELECTION
// ========================================

export async function validateOpportunityServiceDates(
  client: PoolClient,
  opportunityId: number,
  selectedDates: unknown
): Promise<string[]> {
  const dates = normalizeServiceDates(
    selectedDates
  );

  const result = await client.query(
    `
    SELECT
      selected.service_date::text
        AS service_date

    FROM volunteer_opportunities o

    CROSS JOIN LATERAL
      UNNEST($2::date[])
      AS selected(service_date)

    WHERE o.id = $1

      AND selected.service_date
        BETWEEN o.service_start_date
        AND o.service_end_date

      AND selected.service_date >= (
        clock_timestamp()
        AT TIME ZONE 'Asia/Kolkata'
      )::date
    `,
    [opportunityId, dates]
  );

  if (result.rows.length !== dates.length) {
    throw new VolunteerServiceDateError(
      'One or more selected service dates are unavailable'
    );
  }

  return dates;
}

// ========================================
// SAVE MEMBER SERVICE DATES
// ========================================

export async function saveMemberServiceDates(
  client: PoolClient,
  opportunityId: number,
  memberId: number,
  selectedDates: unknown
): Promise<string[]> {
  const dates =
    await validateOpportunityServiceDates(
      client,
      opportunityId,
      selectedDates
    );

  await client.query(
    `
    INSERT INTO volunteer_service_dates (
      opportunity_id,
      member_id,
      service_date
    )

    SELECT
      $1,
      $2,
      selected.service_date

    FROM UNNEST($3::date[])
      AS selected(service_date)

    ON CONFLICT (
      member_id,
      service_date
    )
    DO NOTHING
    `,
    [
      opportunityId,
      memberId,
      dates,
    ]
  );

  return dates;
}