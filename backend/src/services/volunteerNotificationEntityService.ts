import { PoolClient } from 'pg';

// ========================================
// TYPES
// ========================================

export type DeduplicatedVolunteerEvent =
  | 'duty_assigned'
  | 'id_card_issued'
  | 'service_completed'
  | 'certificate_issued';

export interface VolunteerEventEntityReference {
  entityId: number;
  revision: string;
}

export interface ReservedVolunteerEventEntity
  extends VolunteerEventEntityReference {

  reservationId: string;
}

export interface VolunteerEventReservationResult {

  requested: number;

  reserved: ReservedVolunteerEventEntity[];

  duplicates: number;
}

// ========================================
// CONFIGURATION
// ========================================

const SUPPORTED_EVENTS =
  new Set<DeduplicatedVolunteerEvent>([
    'duty_assigned',
    'id_card_issued',
    'service_completed',
    'certificate_issued',
  ]);

const MAX_ENTITY_REFERENCES = 500;

// ========================================
// VALIDATE ID
// ========================================

function isValidId(
  value: unknown
): value is number {

  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 2147483647
  );
}

// ========================================
// VALIDATE BIGINT ID
// ========================================

function isValidBigintId(
  value: unknown
): value is string {

  return (
    typeof value === 'string' &&
    /^[1-9]\d{0,18}$/.test(value) &&
    (
      value.length < 19 ||
      value <= '9223372036854775807'
    )
  );
}

// ========================================
// VALIDATE REVISION
// ========================================

function isValidRevision(
  value: unknown
): value is string {

  return (
    typeof value === 'string' &&
    /^[1-9]\d{0,18}$/.test(value)
  );
}

// ========================================
// VALIDATE TRANSACTION CLIENT
// ========================================

function validateClient(
  client: PoolClient
): void {

  if (
    !client ||
    typeof client.query !== 'function'
  ) {

    throw new Error(
      'Database transaction client is required'
    );
  }
}

// ========================================
// VALIDATE EVENT
// ========================================

function validateEvent(
  event: DeduplicatedVolunteerEvent
): void {

  if (!SUPPORTED_EVENTS.has(event)) {

    throw new Error(
      'Unsupported volunteer deduplication event'
    );
  }
}

// ========================================
// NORMALIZE ENTITY REFERENCES
// ========================================

function normalizeReferences(

  references: VolunteerEventEntityReference[],

  maximumReferences: number

): VolunteerEventEntityReference[] {

  if (
    !Array.isArray(references) ||

    !references.length ||

    references.length > maximumReferences
  ) {

    throw new Error(
      'Invalid volunteer event entity references'
    );
  }

  const uniqueReferences =
    new Map<number, string>();

  for (const reference of references) {

    if (
      !reference ||

      typeof reference !== 'object' ||

      !isValidId(reference.entityId) ||

      !isValidRevision(reference.revision)
    ) {

      throw new Error(
        'Invalid volunteer event entity reference'
      );
    }

    const existingRevision =
      uniqueReferences.get(
        reference.entityId
      );

    if (
      existingRevision !== undefined &&

      existingRevision !== reference.revision
    ) {

      throw new Error(
        'Conflicting revisions for the same volunteer entity'
      );
    }

    uniqueReferences.set(

      reference.entityId,

      reference.revision
    );
  }

  return [...uniqueReferences.entries()]

    .map(([entityId, revision]) => ({

      entityId,

      revision,
    }))

    .sort(
      (a, b) => a.entityId - b.entityId
    );
}

// ========================================
// 1. RESERVE UNIQUE EVENT ENTITY REFERENCES
// ========================================

export async function reserveVolunteerEventEntities(

  event: DeduplicatedVolunteerEvent,

  recipientUserId: number,

  references: VolunteerEventEntityReference[],

  client: PoolClient

): Promise<VolunteerEventReservationResult> {

  validateClient(client);

  validateEvent(event);

  if (!isValidId(recipientUserId)) {

    throw new Error(
      'Invalid volunteer event recipient'
    );
  }

  const maximumReferences =

    event === 'certificate_issued'

      ? 200

      : MAX_ENTITY_REFERENCES;

  const normalizedReferences =
    normalizeReferences(

      references,

      maximumReferences
    );

  const entityIds =
    normalizedReferences.map(

      reference => reference.entityId
    );

  const revisions =
    normalizedReferences.map(

      reference => reference.revision
    );

  // Reserve references inside the existing
  // business database transaction.
  //
  // Concurrent duplicate insertions are
  // prevented by the database unique constraint.

  const result = await client.query(
    `
    INSERT INTO volunteer_notification_event_entities (

      event_type,

      entity_id,

      recipient_user_id,

      event_revision
    )

    SELECT

      $1::varchar,

      reference.entity_id,

      $2::integer,

      reference.event_revision

    FROM UNNEST(

      $3::integer[],

      $4::text[]

    ) AS reference (

      entity_id,

      event_revision
    )

    ORDER BY

      reference.entity_id ASC,

      reference.event_revision ASC

    ON CONFLICT (

      event_type,

      entity_id,

      recipient_user_id,

      event_revision
    )

    DO NOTHING

    RETURNING

      id::text AS reservation_id,

      entity_id,

      event_revision
    `,
    [

      event,

      recipientUserId,

      entityIds,

      revisions,
    ]
  );

  const reserved:
    ReservedVolunteerEventEntity[] =

      result.rows.map(row => ({

        reservationId:
          String(row.reservation_id),

        entityId:
          Number(row.entity_id),

        revision:
          String(row.event_revision),
      }));

  for (const reference of reserved) {

    if (

      !isValidBigintId(
        reference.reservationId
      ) ||

      !isValidId(
        reference.entityId
      ) ||

      !isValidRevision(
        reference.revision
      )
    ) {

      throw new Error(
        'Invalid reserved volunteer event reference'
      );
    }
  }

  reserved.sort(

    (a, b) =>
      a.entityId - b.entityId
  );

  return {

    requested:
      normalizedReferences.length,

    reserved,

    duplicates:

      normalizedReferences.length -

      reserved.length,
  };
}

// ========================================
// 2. LINK RESERVED REFERENCES TO QUEUE JOB
// ========================================

export async function linkVolunteerEventEntities(

  jobId: string,

  event: DeduplicatedVolunteerEvent,

  recipientUserId: number,

  reservationIds: string[],

  client: PoolClient

): Promise<number> {

  validateClient(client);

  validateEvent(event);

  if (!isValidBigintId(jobId)) {

    throw new Error(
      'Invalid volunteer notification job ID'
    );
  }

  if (!isValidId(recipientUserId)) {

    throw new Error(
      'Invalid volunteer event recipient'
    );
  }

  const maximumReferences =

    event === 'certificate_issued'

      ? 200

      : MAX_ENTITY_REFERENCES;

  if (

    !Array.isArray(reservationIds) ||

    !reservationIds.length ||

    reservationIds.length >
      maximumReferences ||

    !reservationIds.every(
      isValidBigintId
    )
  ) {

    throw new Error(
      'Invalid volunteer event reservation IDs'
    );
  }

  const uniqueReservationIds = [

    ...new Set(reservationIds),
  ];

  const result = await client.query(
    `
    UPDATE volunteer_notification_event_entities e

    SET

      job_id = j.id

    FROM volunteer_notification_jobs j

    WHERE j.id = $1::bigint

      AND j.event_type = $2

      AND j.recipient_user_id = $3

      AND j.target_type = 'user'

      AND j.status = 'pending'

      AND e.id = ANY($4::bigint[])

      AND e.event_type = $2

      AND e.recipient_user_id = $3

      AND e.job_id IS NULL

    RETURNING e.id
    `,
    [

      jobId,

      event,

      recipientUserId,

      uniqueReservationIds,
    ]
  );

  const linked =
    result.rowCount ?? 0;

  // Every newly reserved reference must be
  // successfully linked before transaction commit.

  if (
    linked !== uniqueReservationIds.length
  ) {

    throw new Error(
      'Failed to link all volunteer event references'
    );
  }

  return linked;
}