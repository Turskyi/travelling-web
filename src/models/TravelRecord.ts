export interface TravelCity {
  id: string;
  name: string;
  month: string;
}

export interface TravelRecord {
  countryCode: string;
  countryName: string;
  flag: string;
  isVisited: boolean;
  cities: TravelCity[];
  selfieId?: string;
  selfieCloudPath?: string;
}

export type TravelHistory = Record<string, TravelRecord>;
