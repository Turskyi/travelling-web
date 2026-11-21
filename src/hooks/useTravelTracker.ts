import { useCallback, useEffect, useState } from 'react';
import type { Country } from '@/models/Country';
import type { TravelCity, TravelHistory, TravelRecord } from '@/models/TravelRecord';

const STORAGE_KEY = 'travelling.travel-history.v1';

function isTravelHistory(value: unknown): value is TravelHistory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  return Object.values(value).every((record) => {
    if (!record || typeof record !== 'object') return false;
    const candidate = record as Partial<TravelRecord>;
    return (
      typeof candidate.countryCode === 'string' &&
      typeof candidate.countryName === 'string' &&
      typeof candidate.flag === 'string' &&
      typeof candidate.isVisited === 'boolean' &&
      Array.isArray(candidate.cities) &&
      candidate.cities.every(
        (city) =>
          city &&
          typeof city.id === 'string' &&
          typeof city.name === 'string' &&
          typeof city.month === 'string',
      )
    );
  });
}

function countryKey(country: Country) {
  return country.cca3 || country.name.common.toLowerCase();
}

function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function useTravelTracker() {
  const [history, setHistory] = useState<TravelHistory>({});
  const [ready, setReady] = useState(false);
  const [persistenceEnabled, setPersistenceEnabled] = useState(false);
  const [storageError, setStorageError] = useState('');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (!isTravelHistory(parsed)) {
          throw new Error('Saved travel history has an unsupported format.');
        }
        setHistory(parsed);
      }
      setPersistenceEnabled(true);
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : 'Travel history could not be loaded from this browser.',
      );
    } finally {
      setReady(true);
    }

    const syncFromOtherTab = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const parsed: unknown = JSON.parse(event.newValue);
        if (isTravelHistory(parsed)) setHistory(parsed);
      } catch {
        setStorageError('Travel history changed in another tab but could not be read.');
      }
    };

    window.addEventListener('storage', syncFromOtherTab);
    return () => window.removeEventListener('storage', syncFromOtherTab);
  }, []);

  useEffect(() => {
    if (!ready || !persistenceEnabled) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      setStorageError('');
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : 'Travel history could not be saved in this browser.',
      );
    }
  }, [history, persistenceEnabled, ready]);

  const updateCountry = useCallback(
    (country: Country, update: (record: TravelRecord) => TravelRecord) => {
      const key = countryKey(country);
      setHistory((current) => {
        const existing = current[key] || {
          countryCode: key,
          countryName: country.name.common,
          flag: country.flags.svg || country.flags.png,
          isVisited: false,
          cities: [],
        };
        return { ...current, [key]: update(existing) };
      });
    },
    [],
  );

  const setVisited = useCallback(
    (country: Country, isVisited: boolean) => {
      updateCountry(country, (record) => ({ ...record, isVisited }));
    },
    [updateCountry],
  );

  const addCity = useCallback(
    (country: Country, name: string, month: string) => {
      const city: TravelCity = { id: makeId(), name: name.trim(), month };
      updateCountry(country, (record) => ({
        ...record,
        isVisited: true,
        cities: [...record.cities, city],
      }));
    },
    [updateCountry],
  );

  const updateCity = useCallback(
    (country: Country, cityId: string, name: string, month: string) => {
      updateCountry(country, (record) => ({
        ...record,
        cities: record.cities.map((city) =>
          city.id === cityId ? { ...city, name: name.trim(), month } : city,
        ),
      }));
    },
    [updateCountry],
  );

  const removeCity = useCallback(
    (country: Country, cityId: string) => {
      updateCountry(country, (record) => ({
        ...record,
        cities: record.cities.filter((city) => city.id !== cityId),
      }));
    },
    [updateCountry],
  );

  const replaceHistory = useCallback((nextHistory: TravelHistory) => {
    setHistory(nextHistory);
  }, []);

  return {
    history,
    ready,
    storageError,
    setVisited,
    addCity,
    updateCity,
    removeCity,
    replaceHistory,
  };
}
