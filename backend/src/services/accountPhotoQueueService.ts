import type { PoolClient } from 'pg';
import {
  getAccountPhotoPublicId,
} from './accountPhotoValidationService';
export async function queueAccountPhotos(
  client: PoolClient,
  storedUrls: readonly unknown[]
): Promise<number> {  if (storedUrls.every(
    value => value === null || value === undefined || value === ''
  )) {
    return 0;
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (
    !cloudName ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(cloudName)
  ) {
    throw new Error('Photo cleanup configuration invalid');
  }
  const publicIds = new Set<string>();
  for (const storedUrl of storedUrls) {
    if (
      storedUrl === null ||
      storedUrl === undefined ||
      storedUrl === ''
    ) {
      continue;
    }
    const publicId =
      getAccountPhotoPublicId(storedUrl);
    if (!publicId) {
      throw new Error(
        'Photo ownership or storage requires verification'
      );
    }
    publicIds.add(publicId);
  }
  if (publicIds.size === 0) {
    return 0;
  }
  const result = await client.query(
    `
    INSERT INTO public.account_photo_deletion_queue (
      cloud_name,
      cloudinary_public_id
    )
    SELECT
      $1,
      photo_id
    FROM unnest($2::text[]) AS photos(photo_id)
    ON CONFLICT (
      cloud_name,
      cloudinary_public_id
    )
    DO NOTHING
    `,
    [cloudName, Array.from(publicIds)]
  );
  return result.rowCount ?? 0;
}