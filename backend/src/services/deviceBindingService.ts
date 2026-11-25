import { createHash } from 'crypto';
import type { PoolClient } from 'pg';
const MAX_BINDING_VERSION = 2147483647;
export type DeviceBindingIdentity = {
  installationHash: string;
  bindingVersion: number;
};
export class DeviceBindingValidationError extends Error {
  constructor() {
    super('Invalid device binding identity');
    this.name = 'DeviceBindingValidationError';
  }
}
export class DeviceBindingConflictError extends Error {
  constructor() {
    super('Device binding could not be verified');
    this.name = 'DeviceBindingConflictError';
  }
}
export function parseDeviceBinding(
  secret: unknown,
  version: unknown
): DeviceBindingIdentity | null {
  // Legacy application compatibility.
  if (secret === undefined && version === undefined) {
    return null;
  }
  if (
    typeof secret !== 'string' ||
    !/^[a-f0-9]{64}$/.test(secret) ||
    typeof version !== 'number' ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    version > MAX_BINDING_VERSION
  ) {
    throw new DeviceBindingValidationError();
  }
  return {
    installationHash: createHash('sha256')
      .update(secret, 'utf8')
      .digest('hex'),
    bindingVersion: version,
  };
}
// Must run inside the same transaction as the
// corresponding device registration or logout.
export async function claimDeviceBindingVersion(
  client: PoolClient,
  identity: DeviceBindingIdentity
): Promise<void> {
  const result = await client.query(
    `
    INSERT INTO public.device_installation_bindings (
      installation_secret_hash,
      latest_version,
      updated_at
    )
    VALUES ($1, $2, NOW())
    ON CONFLICT (installation_secret_hash)
    DO UPDATE SET
      latest_version = EXCLUDED.latest_version,
      updated_at = NOW()
    WHERE
      device_installation_bindings.latest_version
        < EXCLUDED.latest_version
    RETURNING latest_version
    `,
    [
      identity.installationHash,
      identity.bindingVersion,
    ]
  );
  if (result.rowCount !== 1) {
    throw new DeviceBindingConflictError();
  }
}