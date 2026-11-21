import type { Country } from '@/models/Country';

const ukrainianOverrides: Record<string, string> = {
  'United States': 'США',
  'United States of America': 'США',
  'United Kingdom': 'Велика Британія',
  Czechia: 'Чехія',
  'Czech Republic': 'Чехія',
  'South Korea': 'Південна Корея',
  'North Korea': 'Північна Корея',
  Russia: 'Росія',
  Syria: 'Сирія',
  Moldova: 'Молдова',
  Vietnam: "В'єтнам",
  Laos: 'Лаос',
  'Vatican City': 'Ватикан',
  Taiwan: 'Тайвань',
  Kosovo: 'Косово',
  Bolivia: 'Болівія',
  Venezuela: 'Венесуела',
  Tanzania: 'Танзанія',
  Iran: 'Іран',
  'Ivory Coast': "Кот-д'Івуар",
  'Côte d’Ivoire': "Кот-д'Івуар",
  'Côte d\'Ivoire': "Кот-д'Івуар",
  'Cape Verde': 'Кабо-Верде',
  'Cabo Verde': 'Кабо-Верде',
  'East Timor': 'Східний Тимор',
  'Timor-Leste': 'Тимор-Лешті',
  Micronesia: 'Мікронезія',
  Eswatini: 'Есватіні',
  Swaziland: 'Есватіні',
  Brunei: 'Бруней',
  Myanmar: "М'янма",
  Burma: "М'янма",
  Congo: 'Конго',
  'DR Congo': 'ДР Конго',
  'Republic of the Congo': 'Республіка Конго',
  'Democratic Republic of the Congo': 'Демократична Республіка Конго',
};

export function getCountryDisplayName(country: Country, language: 'en' | 'uk') {
  if (language === 'en') return country.name.common;
  const translated = country.translations?.ukr?.common;
  const override = ukrainianOverrides[country.name.common];
  if (translated) return translated;
  if (override) return override;
  if (country.cca2) {
    const localizedName = new Intl.DisplayNames(['uk'], { type: 'region' }).of(country.cca2);
    if (localizedName && localizedName !== country.cca2) return localizedName;
  }
  return country.name.common;
}
