import type { Country } from '@/models/Country';

const COUNTRY_CACHE_KEY = 'travelling.country-catalog.v1';

function getCachedCountries(): Country[] | null {
    if (typeof window === 'undefined') return null;
    try {
        const value: unknown = JSON.parse(window.localStorage.getItem(COUNTRY_CACHE_KEY) || 'null');
        if (
            Array.isArray(value) &&
            value.every((country) =>
                country &&
                typeof country.cca3 === 'string' &&
                typeof country.name?.common === 'string' &&
                typeof country.flags?.svg === 'string',
            )
        ) {
            return value as Country[];
        }
    } catch {
        return null;
    }
    return null;
}

function cacheCountries(countries: Country[]) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(COUNTRY_CACHE_KEY, JSON.stringify(countries));
    } catch {
        // The live response remains usable when browser storage is unavailable.
    }
}

export async function getCountry(name: string) {
    const countries = await getCountries();
    const normalizedName = name.toLocaleLowerCase();
    return countries.find(
        (country) =>
            country.name.common.toLocaleLowerCase() === normalizedName ||
            country.name.official.toLocaleLowerCase() === normalizedName,
    );
}

export async function getCountries() {
    try {
        const response = await fetch('/api/countries');
        if (!response.ok) {
            throw new Error(`Country catalogue request failed with status ${response.status}.`);
        }
        const countries: Country[] = await response.json();
        cacheCountries(countries);
        return countries;
    } catch (error) {
        const cached = getCachedCountries();
        if (cached) return cached;
        throw error;
    }
}