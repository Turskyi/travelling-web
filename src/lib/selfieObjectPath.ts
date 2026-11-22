const ALLOWED_SELFIE_OBJECT = /^selfies\/[A-Za-z0-9_-]+(?:\.(jpg|png|webp))?$/;

export function getSelfieObjectPath(
  countryData: Record<string, unknown>,
  bucketName: string,
): string | undefined {
  const selfieName = countryData.selfieName;
  if (
    typeof selfieName === 'string' &&
    (/^\d{1,20}$/.test(selfieName) || /^[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(selfieName))
  ) {
    return `selfies/${selfieName}`;
  }

  const selfie = countryData.selfie;
  if (typeof selfie !== 'string') return undefined;
  if (ALLOWED_SELFIE_OBJECT.test(selfie)) return selfie;

  try {
    const url = new URL(selfie);
    const objectPrefix = `/v0/b/${bucketName}/o/`;
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'firebasestorage.googleapis.com' ||
      !url.pathname.startsWith(objectPrefix)
    ) {
      return undefined;
    }

    const objectPath = decodeURIComponent(url.pathname.slice(objectPrefix.length));
    return ALLOWED_SELFIE_OBJECT.test(objectPath) ? objectPath : undefined;
  } catch {
    return undefined;
  }
}
