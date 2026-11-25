import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
export const DEVICE_RECOVERY_POLICY = Object.freeze({
  challengeBytes: 32,
  validitySeconds: 300,
  cooldownSeconds: 60,
  maxAttempts: 5,
  maxRequestsPerHour: 5,
});
const HEX_PATTERN = /^[a-f0-9]{64}$/;
export type DeviceRecoveryChallenge = {
  challenge: string;
  challengeHash: string;
};
export function isValidRecoveryChallenge(
  value: unknown
): value is string {
  return (
    typeof value === 'string' &&
    value.length === 64 &&
    HEX_PATTERN.test(value)
  );
}
export function hashRecoveryChallenge(
  challenge: string
): string {
  if (!isValidRecoveryChallenge(challenge)) {
    throw new Error('Invalid recovery challenge');
  }
  return createHash('sha256')
    .update('temple-device-recovery-v1:', 'utf8')
    .update(challenge, 'utf8')
    .digest('hex');
}
export function createRecoveryChallenge():
  DeviceRecoveryChallenge {
  const challenge = randomBytes(
    DEVICE_RECOVERY_POLICY.challengeBytes
  ).toString('hex');
  return {
    challenge,
    challengeHash: hashRecoveryChallenge(challenge),
  };
}
export function verifyRecoveryChallenge(
  submittedChallenge: unknown,
  storedHash: unknown
): boolean {
  if (
    !isValidRecoveryChallenge(submittedChallenge) ||
    !isValidRecoveryChallenge(storedHash)
  ) {
    return false;
  }
  const submittedHash =
    hashRecoveryChallenge(submittedChallenge);
  return timingSafeEqual(
    Buffer.from(submittedHash, 'hex'),
    Buffer.from(storedHash, 'hex')
  );
}