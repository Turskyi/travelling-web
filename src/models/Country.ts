import { Languages } from "./Languages";

export interface Country {
  name: { official: string; common: string };
  cca2?: string;
  cca3?: string;
  maps: { googleMaps: string };
  flags: { png: string; svg: string };
  coatOfArms?: { png: string; svg: string };
  capital: string[];
  flag: string;
  population?: number;
  languages: Languages;
  translations?: {
    ukr?: { common?: string; official?: string };
  };
}