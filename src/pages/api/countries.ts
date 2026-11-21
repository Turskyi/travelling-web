import type { NextApiRequest, NextApiResponse } from 'next';
import type { Country } from '@/models/Country';

const COUNTRIES_URL =
  'https://raw.githubusercontent.com/mledoze/countries/master/dist/countries.json';
const IMAGE_BASE_URL = 'https://flagcdn.com';

interface SourceCountry {
  name?: { common?: string; official?: string };
  cca2?: string;
  cca3?: string;
  flag?: string;
  capital?: string[];
  population?: number;
  languages?: Record<string, string>;
  translations?: Record<string, { common?: string; official?: string }>;
  latlng?: number[];
}

function isSourceCountry(value: unknown): value is SourceCountry {
  if (!value || typeof value !== 'object') return false;
  const country = value as SourceCountry;
  return Boolean(
    country.cca2 &&
      country.cca3 &&
      country.name?.common &&
      country.name.official,
  );
}

function mapCountry(source: SourceCountry): Country {
  const alpha2 = source.cca2!.toLowerCase();
  const commonName = source.name!.common!;
  const [latitude, longitude] = source.latlng || [];
  return {
    name: {
      common: commonName,
      official: source.name!.official!,
    },
    cca2: source.cca2,
    cca3: source.cca3,
    translations: source.translations,
    maps: {
      googleMaps:
        typeof latitude === 'number' && typeof longitude === 'number'
          ? `https://www.google.com/maps/@${latitude},${longitude},5z`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(commonName)}`,
    },
    flags: {
      png: `${IMAGE_BASE_URL}/w320/${alpha2}.png`,
      svg: `${IMAGE_BASE_URL}/${alpha2}.svg`,
    },
    coatOfArms: { png: '', svg: '' },
    capital: source.capital || [],
    flag: source.flag || '',
    population: source.population,
    languages: source.languages || {},
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Country[] | { error: string }>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(COUNTRIES_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Country catalogue request failed with status ${response.status}.`);
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || !payload.every(isSourceCountry)) {
      throw new Error('Country catalogue response has an invalid format.');
    }

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json(payload.map(mapCountry));
  } catch (error) {
    console.error('Unable to load country catalogue:', error);
    return res.status(502).json({
      error: 'Country catalogue is temporarily unavailable.',
    });
  }
}
