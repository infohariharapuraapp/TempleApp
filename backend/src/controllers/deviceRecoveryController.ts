import { createHash } from 'crypto';
import type { Response } from 'express';
import type { PoolClient } from 'pg';
import { Expo } from 'expo-server-sdk';
import { pool } from '../db';
import type { AuthRequest } from '../middleware/authMiddleware';
import {
  parseDeviceBinding,
  claimDeviceBindingVersion,
  DeviceBindingConflictError,
  DeviceBindingValidationError,
} from '../services/deviceBindingService';
import {
  createRecoveryChallenge,
  verifyRecoveryChallenge,
  isValidRecoveryChallenge,
  DEVICE_RECOVERY_POLICY,
} from '../services/deviceRecoveryCryptoService';
const expo = new Expo();
class RecoveryError extends Error {
  constructor(public status: number) {
    super('Device recovery unavailable');
  }
}
async function transaction<T>(
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '10s'");
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      discard = true;
    }
    throw error;
  } finally {
    client.release(discard);
  }
}
function recoveryFailure(
  res: Response,
  error: unknown
) {
  const status =
    error instanceof RecoveryError
      ? error.status
      : error instanceof DeviceBindingValidationError
        ? 400
        : error instanceof DeviceBindingConflictError
          ? 409
          : 500;
  if (status === 500) {
    console.error('Device recovery operation failed');
  }
  return res.status(status).json({
    success: false,
    message: 'Device recovery could not be completed',
  });
}
function getRecoveryInput(req: AuthRequest) {
  const userId = req.user?.userId;
  if (
    !userId ||
    !Number.isSafeInteger(userId) ||
    userId <= 0
  ) {
    throw new RecoveryError(401);
  }
  const body = req.body ?? {};
  const token = body.expoPushToken;
  if (
    typeof token !== 'string' ||
    token.length > 512 ||
    token !== token.trim() ||
    !Expo.isExpoPushToken(token)
  ) {
    throw new RecoveryError(400);
  }
  const identity = parseDeviceBinding(
    body.installationSecret,
    body.bindingVersion
  );
  if (!identity) {
    throw new RecoveryError(400);
  }
  const authorization = req.headers.authorization;
  if (
    typeof authorization !== 'string' ||
    !/^Bearer [^\s]+$/i.test(authorization)
  ) {
    throw new RecoveryError(401);
  }
  const sessionHash = createHash('sha256')
    .update('temple-recovery-session-v1:', 'utf8')
    .update(authorization.slice(7), 'utf8')
    .digest('hex');
  return { userId, token, identity, sessionHash };
}
export async function requestDeviceRecovery(
  req: AuthRequest,
  res: Response
) {
  try {
    const { userId, token, identity, sessionHash } =
      getRecoveryInput(req);
    const challenge = createRecoveryChallenge();
    const recoveryId = await transaction(
      async client => {
        // Serialize recovery requests across instances.
        await client.query(
          'SELECT pg_advisory_xact_lock(827431, 1)'
        );
        const result = await client.query(
          `
          SELECT
            id,
            user_id,
            installation_secret_hash,
            binding_version,
            updated_at::text AS snapshot_time
          FROM public.device_tokens
          WHERE expo_push_token = $1
          FOR UPDATE
          `,
          [token]
        );
        const device = result.rows[0];
        if (
          !device ||
          !device.user_id ||
          !device.snapshot_time
        ) {
          throw new RecoveryError(409);
        }
        // Existing installations must use normal registration.
        if (
          device.installation_secret_hash ===
          identity.installationHash
        ) {
          throw new RecoveryError(409);
        }
        // Database-wide limit shared across backend instances.
        const globalLimit = await client.query(`
          SELECT COUNT(*)::int AS total
          FROM public.device_binding_recovery
          WHERE created_at > NOW() - INTERVAL '1 hour'
        `);
        if (globalLimit.rows[0].total >= 300) {
          throw new RecoveryError(429);
        }
        const limits = await client.query(
          `
          SELECT
            COUNT(*) FILTER (
              WHERE user_id = $1
            )::int AS account_requests,
            COUNT(*) FILTER (
              WHERE device_token_id = $2
            )::int AS device_requests,
            COUNT(*) FILTER (
              WHERE created_at >
                NOW() - ($3::int * INTERVAL '1 second')
            )::int AS recent_requests
          FROM public.device_binding_recovery
          WHERE created_at > NOW() - INTERVAL '1 hour'
            AND (
              user_id = $1
              OR device_token_id = $2
            )
          `,
          [
            userId,
            device.id,
            DEVICE_RECOVERY_POLICY.cooldownSeconds,
          ]
        );
        const counts = limits.rows[0];
        if (
          counts.recent_requests > 0 ||
          counts.account_requests >=
            DEVICE_RECOVERY_POLICY.maxRequestsPerHour ||
          counts.device_requests >=
            DEVICE_RECOVERY_POLICY.maxRequestsPerHour
        ) {
          throw new RecoveryError(429);
        }
        // Remove old challenges in bounded batches.
        // Preserve recent records for abuse prevention.
        await client.query(`
          DELETE FROM public.device_binding_recovery
          WHERE id IN (
            SELECT id
            FROM public.device_binding_recovery
            WHERE expires_at <
              NOW() - INTERVAL '24 hours'
            ORDER BY expires_at
            LIMIT 200
            FOR UPDATE SKIP LOCKED
          )
        `);
        const inserted = await client.query(
          `
          INSERT INTO public.device_binding_recovery (
            user_id,
            device_token_id,
            challenge_hash,
            new_installation_hash,
            new_binding_version,
            previous_installation_hash,
            previous_binding_version,
            previous_user_id,
            previous_updated_at,
            session_token_hash,
            expires_at
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9::timestamp,
            $11,
            NOW() + ($10::int * INTERVAL '1 second')
          )
          RETURNING id::text
          `,
          [
            userId,
            device.id,
            challenge.challengeHash,
            identity.installationHash,
            identity.bindingVersion,
            device.installation_secret_hash,
            device.binding_version,
            device.user_id,
            device.snapshot_time,
            DEVICE_RECOVERY_POLICY.validitySeconds,
            sessionHash,
          ]
        );
        return String(inserted.rows[0].id);
      }
    );
    // Data-only challenge: no visible title or body.
    const tickets = await expo.sendPushNotificationsAsync([
      {
        to: token,
        priority: 'high',
        ttl: DEVICE_RECOVERY_POLICY.validitySeconds,
        data: {
          type: 'device_binding_recovery',
          recoveryId,
          challenge: challenge.challenge,
        },
      },
    ]);
    if (
      tickets.length !== 1 ||
      tickets[0].status !== 'ok'
    ) {
      throw new RecoveryError(503);
    }
    return res.status(202).json({
      success: true,
      data: {
        recoveryId,
        expiresIn:
          DEVICE_RECOVERY_POLICY.validitySeconds,
      },
    });
  } catch (error) {
    return recoveryFailure(res, error);
  }
}
export async function confirmDeviceRecovery(
  req: AuthRequest,
  res: Response
) {
  try {
    const { userId, token, identity, sessionHash } =
      getRecoveryInput(req);
    const { recoveryId, challenge } = req.body ?? {};
    if (
      typeof recoveryId !== 'string' ||
      !/^[1-9][0-9]{0,18}$/.test(recoveryId) ||
      BigInt(recoveryId) > 9223372036854775807n ||
      !isValidRecoveryChallenge(challenge)
    ) {
      throw new RecoveryError(400);
    }
    const confirmed = await transaction(
      async client => {
        const result = await client.query(
          `
          SELECT *
          FROM public.device_binding_recovery
          WHERE id = $1::bigint
            AND user_id = $2
            AND new_installation_hash = $3
            AND new_binding_version = $4
            AND consumed_at IS NULL
            AND expires_at > clock_timestamp()
            AND attempt_count < $5
            AND session_token_hash = $6
          FOR UPDATE
          `,
          [
            recoveryId,
            userId,
            identity.installationHash,
            identity.bindingVersion,
            DEVICE_RECOVERY_POLICY.maxAttempts,
            sessionHash,
          ]
        );
        const recovery = result.rows[0];
        if (!recovery) return false;
        await client.query(
          `
          UPDATE public.device_binding_recovery
          SET attempt_count = attempt_count + 1
          WHERE id = $1::bigint
          `,
          [recoveryId]
        );
        if (
          !verifyRecoveryChallenge(
            challenge,
            recovery.challenge_hash
          )
        ) {
          return false;
        }
        await claimDeviceBindingVersion(
          client,
          identity
        );
        const updated = await client.query(
          `
          UPDATE public.device_tokens dt
          SET
            user_id = $1,
            installation_secret_hash = $2,
            binding_version = $3,
            is_active = FALSE,
            updated_at = clock_timestamp()
          FROM public.device_binding_recovery r
          WHERE r.id = $4::bigint
            AND dt.id = r.device_token_id
            AND dt.expo_push_token = $5
            AND dt.user_id = r.previous_user_id
            AND dt.binding_version =
                r.previous_binding_version
            AND dt.installation_secret_hash
                IS NOT DISTINCT FROM
                r.previous_installation_hash
            AND dt.updated_at =
                r.previous_updated_at
            AND r.expires_at > clock_timestamp()
            AND r.consumed_at IS NULL
          RETURNING dt.id
          `,
          [
            userId,
            identity.installationHash,
            identity.bindingVersion,
            recoveryId,
            token,
          ]
        );
        if (updated.rowCount !== 1) {
          throw new RecoveryError(409);
        }
        await client.query(
          `
          UPDATE public.device_binding_recovery
          SET consumed_at = clock_timestamp()
          WHERE id = $1::bigint
          `,
          [recoveryId]
        );
        return true;
      }
    );
    if (!confirmed) {
      throw new RecoveryError(409);
    }
    return res.status(200).json({
      success: true,
      data: {
        recovered: true,
        registrationRequired: true,
      },
    });
  } catch (error) {
    return recoveryFailure(res, error);
  }
}