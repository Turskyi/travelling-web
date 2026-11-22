import crypto from 'crypto';

/**
 * Generates an opaque, deterministic public ID from a Firebase UID
 * so raw UIDs are never exposed in public API responses.
 */
export function getPublicTravellerId(uid: string): string {
  if (!uid) return '';
  const hash = crypto.createHash('sha256').update(`traveller:${uid}`).digest('hex');
  return `tr_${hash.substring(0, 16)}`;
}

/**
 * Sanitizes a user display name to ensure email addresses are never leaked.
 */
export function sanitizeDisplayName(name?: string | null, fallback = 'Traveller'): string {
  if (!name || typeof name !== 'string') return fallback;
  const trimmed = name.trim();
  if (!trimmed) return fallback;

  // If name appears to be an email address, extract the username portion or fallback
  if (trimmed.includes('@')) {
    const parts = trimmed.split('@');
    const username = parts[0]?.trim();
    return username || fallback;
  }

  return trimmed;
}

export interface PublicTravellerSummary {
  id: string;
  name: string;
  avatar: string;
  counter: number;
}

export interface PublicVisitedCountry {
  id: number;
  name: string;
  shortName: string;
  flag: string;
  isVisited: boolean;
}

export interface PublicVisitedCity {
  id: number;
  parentId: number;
  name: string;
  month?: string;
}

export interface PublicTravellerDetail extends PublicTravellerSummary {
  visitedCountries: PublicVisitedCountry[];
  cities: PublicVisitedCity[];
}

/**
 * Maps a Firestore user document to a public traveller summary.
 * Strictly omits any private fields (email, raw UID, admin status, timestamps, etc.)
 */
export function toPublicTravellerSummary(
  uid: string,
  docData: Record<string, any>,
): PublicTravellerSummary {
  return {
    id: getPublicTravellerId(uid),
    name: sanitizeDisplayName(docData.name),
    avatar: typeof docData.avatar === 'string' ? docData.avatar : '',
    counter: typeof docData.counter === 'number' ? Math.max(0, docData.counter) : 0,
  };
}

/**
 * Maps Firestore data to a public traveller detail view.
 */
export function toPublicTravellerDetail(
  uid: string,
  docData: Record<string, any>,
  countriesData: Record<string, any>[],
  citiesData: Record<string, any>[],
): PublicTravellerDetail {
  const summary = toPublicTravellerSummary(uid, docData);

  const visitedCountries: PublicVisitedCountry[] = countriesData
    .filter((c) => c && c.isVisited !== false)
    .map((c, idx) => ({
      id: typeof c.id === 'number' ? c.id : idx + 1,
      name: String(c.title || c.name || c.shortName || ''),
      shortName: String(c.shortName || c.title || c.name || ''),
      flag: String(c.flag || ''),
      isVisited: true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const cities: PublicVisitedCity[] = citiesData
    .filter((city) => city && city.name)
    .map((city, idx) => ({
      id: typeof city.id === 'number' ? city.id : idx + 1,
      parentId: typeof city.parentId === 'number' ? city.parentId : 0,
      name: String(city.name),
      month: typeof city.month === 'string' ? city.month : '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    ...summary,
    visitedCountries,
    cities,
  };
}
