const PRIVATE_PHOTO_ID =
  /^temple-app\/volunteer\/photos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidAccountPhotoId(
  value: unknown
): value is string {
  return (
    typeof value === 'string' &&
    PRIVATE_PHOTO_ID.test(value)
  );
}
export function getAccountPhotoPublicId(
  storedUrl: unknown
): string | null {
  if (
    typeof storedUrl !== 'string' ||
    storedUrl.length > 2048
  ) {
    return null;
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (
    !cloudName ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(cloudName)
  ) {
    return null;
  }
  try {
    const url = new URL(storedUrl);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'res.cloudinary.com' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    const prefix =
      `/${cloudName}/image/authenticated/`;
    if (!url.pathname.startsWith(prefix)) {
      return null;
    }
    const resourcePath = url.pathname
      .slice(prefix.length)
      .replace(/^s--[A-Za-z0-9_-]+--\//, '')
      .replace(/^v\d+\//, '');
    if (!resourcePath.endsWith('.webp')) {
      return null;
    }
    const publicId = resourcePath.slice(0, -5);
    return isValidAccountPhotoId(publicId)
      ? publicId
      : null;
  } catch {
    return null;
  }
}
