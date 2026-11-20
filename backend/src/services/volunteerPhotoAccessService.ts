import cloudinary from '../config/cloudinary';

export function createVolunteerPhotoAccessUrl(
  storedUrl: string | null
): string | null {
  if (!storedUrl) {
    return null;
  }

  try {
    const url = new URL(storedUrl);

    const cloudName =
      process.env.CLOUDINARY_CLOUD_NAME;

    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'res.cloudinary.com' ||
      !cloudName
    ) {
      return null;
    }

    const prefix =
      `/${cloudName}/image/authenticated/`;

    if (!url.pathname.startsWith(prefix)) {
      return null;
    }

    const path = url.pathname
      .slice(prefix.length)
      .replace(/^s--[A-Za-z0-9_-]+--\//, '')
      .replace(/^v\d+\//, '');

    const match = path.match(
      /^(temple-app\/volunteer\/photos\/[0-9a-f-]{36})\.webp$/i
    );

    if (!match) {
      return null;
    }

    return cloudinary.utils.private_download_url(
      match[1],
      'webp',
      {
        resource_type: 'image',
        type: 'authenticated',
        expires_at: Math.floor(Date.now() / 1000) + 300,
        attachment: false,
      }
    );

  } catch {
    return null;
  }
}

/**
 * Generate a temporary photo URL for an authorized API response.
 * Never persist this returned URL in the database.
 */
export function withVolunteerPhotoAccess<
  T extends { photo_url: string | null }
>(row: T) {
  return {
    ...row,
    photo_url: createVolunteerPhotoAccessUrl(
      row.photo_url
    ),
  };
}
